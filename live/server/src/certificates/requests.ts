import { createHmac } from 'node:crypto';
import type pg from 'pg';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ShopifyAdminClient } from './shopify.js';
import type { CertificateService } from './service.js';
import type { CertificateMailer, ShopifyFulfilledOrder } from './types.js';
import { requestCertificatePage } from './request-page.js';

const RECEIVED = 'Request received. If the details match an eligible order, we will email your certificate to the address used at checkout. Older orders may need a manual check.';
const inputSchema = z.object({
  orderNumber: z.string().trim().regex(/^#?\d{1,12}$/),
  email: z.string().trim().email().max(254),
  website: z.string().max(500).optional(),
});
export function registerCertificateRequestRoutes(app: FastifyInstance, pool: pg.Pool, baseUrl: string, rateSecret: string): void {
  app.get('/request', async (_request, reply) => reply.header('Cache-Control', 'no-store')
    .header('Referrer-Policy', 'no-referrer').type('text/html').send(requestCertificatePage));
  app.post('/certificate-requests', { bodyLimit: 4096 }, async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    if (request.headers.origin && request.headers.origin !== new URL(baseUrl).origin) {
      return reply.code(403).send({ message: 'Please submit your request from our certificate page.' });
    }
    const parsed = inputSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: 'Enter your order number and the email used at checkout.' });
    if (parsed.data.website) return reply.code(202).send({ message: RECEIVED });
    const order = '#' + parsed.data.orderNumber.replace(/^#/, '');
    const email = parsed.data.email.toLowerCase();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Persist limits across restarts and replicas; never store raw IP addresses.
      for (const [value, maximum] of [[`ip:${request.ip}`, 20], [`email:${email}`, 5]] as const) {
        const key = createHmac('sha256', rateSecret).update(value).digest('hex');
        const { rows } = await client.query(`INSERT INTO certificate_request_limits(key) VALUES($1)
          ON CONFLICT(key,bucket) DO UPDATE SET count=certificate_request_limits.count+1 RETURNING count`, [key]);
        if (rows[0].count > maximum) {
          await client.query('COMMIT');
          return reply.code(429).send({ message: 'Too many requests today. Please try again tomorrow or contact us.' });
        }
      }
      // Serialize identical requests so concurrent submits cannot produce duplicate emails.
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [order + ':' + email]);
      const duplicate = await client.query(`SELECT id FROM certificate_requests WHERE order_name=$1 AND email=$2
        AND (status IN ('pending','processing','needs_review') OR created_at > now()-interval '24 hours') LIMIT 1`, [order,email]);
      if (!duplicate.rowCount) await client.query('INSERT INTO certificate_requests(order_name,email) VALUES($1,$2)', [order,email]);
      await client.query('DELETE FROM certificate_request_limits WHERE bucket < CURRENT_DATE-2');
      await client.query('COMMIT');
      return reply.code(202).send({ message: RECEIVED });
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  });
}

export type RequestOrder = {
  id: string; name: string; email: string | null; cancelledAt: string | null;
  displayFinancialStatus: string; displayFulfillmentStatus: string;
  lineItems: { nodes: Array<{ id: string; title: string; vendor: string | null; sku: string | null;
    quantity: number; currentQuantity: number; product: { id: string } | null }>;
    pageInfo: { hasNextPage: boolean } };
};
export async function findRequestOrder(shopify: ShopifyAdminClient, name: string): Promise<RequestOrder | null> {
  const data = await shopify.query<{orders:{nodes:RequestOrder[]}}>(`query CertificateRequestOrder($query:String!){
    orders(first:10,query:$query){nodes{id name email cancelledAt displayFinancialStatus displayFulfillmentStatus
      lineItems(first:100){nodes{id title vendor sku quantity currentQuantity product{id}} pageInfo{hasNextPage}}}}
  }`, { query: `name:${name.slice(1)}` });
  return data.orders.nodes.find(order => order.name === name) ?? null;
}
export function requestEligibility(order: RequestOrder, name: string, email: string): string | null {
  if (order.name !== name || order.email?.trim().toLowerCase() !== email.trim().toLowerCase()) return 'order_email_mismatch';
  if (order.cancelledAt || order.displayFinancialStatus !== 'PAID') return 'payment_or_cancellation_review';
  if (order.displayFulfillmentStatus !== 'FULFILLED') return 'fulfillment_review';
  if (order.lineItems.pageInfo.hasNextPage || !order.lineItems.nodes.length || order.lineItems.nodes.some(line =>
    !line.product || line.quantity !== 1 || line.currentQuantity !== 1)) return 'line_item_review';
  return null;
}

type RequestRow = {id:string;order_name:string;email:string;attempts:number};
type Dependencies = { findOrder(name:string):Promise<RequestOrder|null>; service: Pick<CertificateService,'processFulfilledOrder'>;
  mailer:CertificateMailer; baseUrl:string };
export async function deliverCertificateRequest(pool:pg.Pool, job:RequestRow, order:RequestOrder, deps:Dependencies):Promise<void> {
  const reason = requestEligibility(order,job.order_name,job.email);
  if (reason) {
    await pool.query(`UPDATE certificate_requests SET status=$2,reason=$3,processing_started_at=NULL WHERE id=$1`,
      [job.id,reason==='order_email_mismatch'?'rejected':'needs_review',reason]);
    return;
  }
  const orderId=order.id.split('/').at(-1)!;
  const revoked=await pool.query(`SELECT 1 FROM authenticity_certificates WHERE shopify_order_id=$1 AND status='revoked' LIMIT 1`,[orderId]);
  if(revoked.rowCount){await pool.query(`UPDATE certificate_requests SET status='needs_review',reason='revoked_certificate',processing_started_at=NULL WHERE id=$1`,[job.id]);return;}
  const payload:ShopifyFulfilledOrder={id:orderId,admin_graphql_api_id:order.id,name:order.name,
    // Delivery is handled below with a per-request key, including repeat downloads.
    line_items:order.lineItems.nodes.map(line=>({id:line.id.split('/').at(-1)!,product_id:line.product!.id.split('/').at(-1)!,
      title:line.title,vendor:line.vendor,sku:line.sku,quantity:line.quantity}))};
  const certificates=await deps.service.processFulfilledOrder(payload);
  if(certificates.length!==payload.line_items.length||certificates.some(c=>c.status!=='active'||!c.pdfPath))throw new Error('certificate_set_requires_review');
  await deps.mailer.sendCertificateEmail({email:order.email!,orderName:order.name,certificates,publicBaseUrl:deps.baseUrl,idempotencyKey:`certificate-request-${job.id}`});
  await pool.query(`UPDATE certificate_requests SET status='sent',reason=NULL,completed_at=now(),processing_started_at=NULL WHERE id=$1`,[job.id]);
}
export async function processNextCertificateRequest(pool:pg.Pool,deps:Dependencies):Promise<boolean>{
  const {rows}=await pool.query<RequestRow>(`UPDATE certificate_requests SET status='processing',attempts=attempts+1,processing_started_at=now()
    WHERE id=(SELECT id FROM certificate_requests WHERE (status='pending' AND next_attempt_at<=now())
      OR (status='processing' AND processing_started_at<now()-interval '20 minutes')
      ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING id,order_name,email,attempts`);
  const job=rows[0];if(!job)return false;
  try{
    const order=await deps.findOrder(job.order_name);
    if(!order){await pool.query(`UPDATE certificate_requests SET status='needs_review',reason='order_not_accessible',processing_started_at=NULL WHERE id=$1`,[job.id]);return true;}
    await deliverCertificateRequest(pool,job,order,deps);
  }catch{
    // Do not persist customer data or provider response bodies in error messages.
    await pool.query(`UPDATE certificate_requests SET status=$2,reason='processing_failed',processing_started_at=NULL,
      next_attempt_at=now()+interval '5 minutes' WHERE id=$1`,[job.id,job.attempts>=5?'needs_review':'pending']);
  }
  return true;
}

export async function processNextReviewNotification(pool:pg.Pool,notify:(input:{id:string;orderName:string;email:string;reason:string})=>Promise<void>):Promise<boolean>{
  const {rows}=await pool.query(`UPDATE certificate_requests SET review_notification_attempts=review_notification_attempts+1,
    review_next_attempt_at=now()+interval '10 minutes'
    WHERE id=(SELECT id FROM certificate_requests WHERE status='needs_review' AND review_notified_at IS NULL
      AND review_next_attempt_at<=now() AND review_notification_attempts<5 ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1)
    RETURNING id,order_name,email,reason`);
  const row=rows[0];if(!row)return false;
  try{await notify({id:row.id,orderName:row.order_name,email:row.email,reason:row.reason});
    await pool.query('UPDATE certificate_requests SET review_notified_at=now() WHERE id=$1',[row.id]);
  }catch{/* Durable retry above; a failure never loses the customer request. */}
  return true;
}
