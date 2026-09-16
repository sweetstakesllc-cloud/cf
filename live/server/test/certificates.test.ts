import { createHmac } from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { FakePaymentGateway } from '../src/billing/gateway.js';
import type { Mailer } from '../src/mailer.js';
import { CertificateService } from '../src/certificates/service.js';
import { deliverCertificateRequest, type RequestOrder } from '../src/certificates/requests.js';
import { processNextCertificateJob } from '../src/certificates/worker.js';
import type {
  CertificateGenerator,
  CertificateMailer,
  CertificateRecord,
  ProductSnapshot,
  ShopifyAdmin,
  ShopifyFulfilledOrder,
} from '../src/certificates/types.js';
import { getTestPool, truncateAll } from './helpers.js';

const WEBHOOK_SECRET = 'shopify-test-secret';
const noopMailer: Mailer = { async sendOtp() {} };
let pool: pg.Pool;
let app: FastifyInstance;

beforeAll(async () => {
  pool = await getTestPool();
  app = buildApp({
    config: loadConfig({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgres://cf:cf@localhost:5433/cf_live',
      COOKIE_SECRET: 'test-cookie-secret-at-least-32-chars!!',
      SHOPIFY_WEBHOOK_SECRET: WEBHOOK_SECRET,
    }),
    pool,
    mailer: noopMailer,
    gateway: new FakePaymentGateway(),
  });
});
afterAll(async () => { await app.close(); await pool.end(); });
beforeEach(async () => { await truncateAll(pool); });

function signature(body: string): string {
  return createHmac('sha256', WEBHOOK_SECRET).update(body).digest('base64');
}

function fulfilledOrder(): ShopifyFulfilledOrder {
  return {
    id: 7001,
    admin_graphql_api_id: 'gid://shopify/Order/7001',
    name: '#7001',
    contact_email: 'buyer@example.se',
    financial_status: 'paid',
    cancelled_at: null,
    line_items: [
      { id: 81, product_id: 901, title: 'Maya Jacket', vendor: 'Moncler', sku: 'CF-901' },
      { id: 82, product_id: 902, title: 'Down Jacket', vendor: 'Prada', sku: 'CF-902' },
    ],
  };
}

class FakeShopify implements ShopifyAdmin {
  updates: CertificateRecord[][] = [];
  async getProduct(productId: string): Promise<ProductSnapshot> {
    return {
      title: productId === '901' ? 'Maya Jacket' : 'Down Jacket',
      brand: productId === '901' ? 'Moncler' : 'Prada',
      imageUrls: [`https://cdn.example/${productId}.jpg`],
      authenticationPartner: 'Authentic Detective',
      authenticationReportNumber: `AD-${productId}`,
    };
  }
  async setOrderCertificates(_orderGid: string, certificates: CertificateRecord[]): Promise<void> {
    this.updates.push(certificates);
  }
}

class FakeGenerator implements CertificateGenerator {
  rendered: string[] = [];
  async render(input: { token: string }): Promise<string> {
    this.rendered.push(input.token);
    return `${input.token}.pdf`;
  }
}

class FakeCertificateMailer implements CertificateMailer {
  sent: Array<{ email: string; certificates: CertificateRecord[]; idempotencyKey: string }> = [];
  async sendCertificateEmail(input: { email: string; certificates: CertificateRecord[]; idempotencyKey: string }): Promise<void> {
    this.sent.push(input);
  }
}

describe('Shopify certificate webhooks', () => {
  it.each(['paid','fulfilled'])('verifies HMAC and deduplicates orders/%s', async event => {
    const body = JSON.stringify(fulfilledOrder());
    const headers = {
      'content-type': 'application/json',
      'x-shopify-hmac-sha256': signature(body),
      'x-shopify-webhook-id': 'webhook-1',
      'x-shopify-topic': `orders/${event}`,
      'x-shopify-shop-domain': 'circular-fash.myshopify.com',
    };
    const first = await app.inject({ method: 'POST', url: `/webhooks/shopify/orders-${event}`, headers, payload: body });
    expect(first.statusCode).toBe(202);
    expect(first.json()).toEqual({ received: true, duplicate: false });
    const duplicate = await app.inject({ method: 'POST', url: `/webhooks/shopify/orders-${event}`, headers, payload: body });
    expect(duplicate.statusCode).toBe(202);
    expect(duplicate.json()).toEqual({ received: true, duplicate: true });
    const { rows } = await pool.query(`SELECT count(*)::int AS count FROM shopify_webhooks`);
    expect(rows[0].count).toBe(1);
  });

  it.each(['paid','fulfilled'])('rejects a forged orders/%s delivery', async event => {
    const response = await app.inject({
      method: 'POST',
      url: `/webhooks/shopify/orders-${event}`,
      headers: {
        'content-type': 'application/json',
        'x-shopify-hmac-sha256': 'not-valid',
        'x-shopify-webhook-id': 'webhook-2',
        'x-shopify-topic': `orders/${event}`,
      },
      payload: JSON.stringify(fulfilledOrder()),
    });
    expect(response.statusCode).toBe(401);
  });
});

describe('certificate processing', () => {
  it('emails all paid-order certificates once, including after webhook replay and fulfillment', async () => {
    const order = fulfilledOrder();
    order.line_items[0]!.quantity = 2;
    const mailer = new FakeCertificateMailer();
    const generator = new FakeGenerator();
    const service = new CertificateService(pool, new FakeShopify(), generator, mailer, 'https://certificates.example.com');
    for (const [index, event] of ['paid', 'paid', 'fulfilled'].entries()) {
      const body = JSON.stringify(order);
      const response = await app.inject({ method: 'POST', url: `/webhooks/shopify/orders-${event}`, payload: body,
        headers: { 'content-type': 'application/json', 'x-shopify-hmac-sha256': signature(body),
          'x-shopify-webhook-id': `paid-${index}`, 'x-shopify-topic': `orders/${event}` } });
      expect(response.statusCode).toBe(202);
      expect(await processNextCertificateJob(pool, service)).toBe(true);
      expect(mailer.sent).toHaveLength(1);
      expect(mailer.sent[0]?.certificates).toHaveLength(3);
    }
    expect(generator.rendered).toHaveLength(3);
  });

  it.each(['pending', 'authorized', 'partially_paid', 'refunded', 'partially_refunded', 'voided', undefined, 'cancelled'])
  ('does not issue certificates from an ineligible webhook (%s)', async status => {
    const order = {...fulfilledOrder(), financial_status: status === 'cancelled' ? 'paid' : status,
      cancelled_at: status === 'cancelled' ? '2026-09-16T12:00:00Z' : null};
    await pool.query(`INSERT INTO shopify_webhooks(webhook_id,topic,payload) VALUES('ineligible','orders/fulfilled',$1)`,[JSON.stringify(order)]);
    const mailer = new FakeCertificateMailer();
    const generator = new FakeGenerator();
    const service = new CertificateService(pool, new FakeShopify(), generator, mailer, 'https://certificates.example.com');
    expect(await processNextCertificateJob(pool, service)).toBe(true);
    expect(mailer.sent).toHaveLength(0);
    expect(generator.rendered).toHaveLength(0);
    expect((await pool.query('SELECT status FROM shopify_webhooks')).rows[0].status).toBe('completed');
  });

  it('records requested delivery so later paid and fulfillment events do not resend', async () => {
    const order = fulfilledOrder();
    const mailer = new FakeCertificateMailer();
    const service = new CertificateService(pool, new FakeShopify(), new FakeGenerator(), mailer, 'https://certificates.example.com');
    const request = (await pool.query(`INSERT INTO certificate_requests(order_name,email,status) VALUES($1,$2,'processing') RETURNING id,order_name,email,attempts`,
      [order.name,order.contact_email])).rows[0];
    const requestOrder: RequestOrder = { id: order.admin_graphql_api_id!, name: order.name!, email: order.contact_email!,
      cancelledAt: null, displayFinancialStatus: 'PAID', displayFulfillmentStatus: 'UNFULFILLED',
      lineItems: {pageInfo:{hasNextPage:false},nodes:order.line_items.map(line=>({id:`gid://shopify/LineItem/${line.id}`,
        title:line.title!,vendor:line.vendor??null,sku:line.sku??null,quantity:1,currentQuantity:1,product:{id:`gid://shopify/Product/${line.product_id}`}}))} };
    await deliverCertificateRequest(pool, request, requestOrder, {findOrder:async()=>requestOrder,service,mailer,baseUrl:'https://certificates.example.com'});
    expect(mailer.sent).toHaveLength(1);
    expect((await pool.query('SELECT emailed_at FROM authenticity_certificates')).rows.every(c=>c.emailed_at)).toBe(true);
    for (const event of ['paid','fulfilled']) {
      await pool.query(`INSERT INTO shopify_webhooks(webhook_id,topic,payload) VALUES($1,$2,$3)`,[event,`orders/${event}`,JSON.stringify(order)]);
      await processNextCertificateJob(pool,service);
    }
    expect(mailer.sent).toHaveLength(1);
    await pool.query('DELETE FROM certificate_requests WHERE id=$1',[request.id]);
  });

  it('creates a unique certificate per unit and preserves all links on retries', async () => {
    const generator = new FakeGenerator();
    const mailer = new FakeCertificateMailer();
    const shopify = new FakeShopify();
    const service = new CertificateService(pool, shopify, generator, mailer, 'https://certificates.example.com');
    const order = fulfilledOrder();
    order.line_items[0]!.quantity = 2;
    const first = await service.processFulfilledOrder(order);
    expect(first).toHaveLength(3);
    expect(new Set(first.map(certificate => certificate.token)).size).toBe(3);
    expect(new Set(first.map(certificate => certificate.certificateNumber)).size).toBe(3);
    expect(generator.rendered).toHaveLength(3);
    expect(mailer.sent[0]?.certificates).toHaveLength(3);
    expect(shopify.updates[0]).toHaveLength(3);
    expect((await service.processFulfilledOrder(order)).map(c => c.token)).toEqual(first.map(c => c.token));
    expect(mailer.sent).toHaveLength(1);
    expect(generator.rendered).toHaveLength(3);
  });

  it('adds missing units to an existing order without replacing its certificates', async () => {
    const generator = new FakeGenerator();
    const mailer = new FakeCertificateMailer();
    const service = new CertificateService(pool, new FakeShopify(), generator, mailer, 'https://certificates.example.com');
    const order = fulfilledOrder();
    const original = await service.processFulfilledOrder(order);
    order.line_items[0]!.quantity = 2;
    const expanded = await service.processFulfilledOrder(order);
    expect(expanded).toHaveLength(3);
    expect(expanded.map(c => c.token)).toEqual(expect.arrayContaining(original.map(c => c.token)));
    expect(generator.rendered).toHaveLength(3);
    expect(mailer.sent).toHaveLength(2);
    expect(mailer.sent[1]?.idempotencyKey).not.toBe(mailer.sent[0]?.idempotencyKey);
    await service.processFulfilledOrder(order);
    expect(mailer.sent).toHaveLength(2);
  });

  it('finishes a partially generated multi-item order before sending any email', async () => {
    const generator = new FakeGenerator();
    const render = vi.spyOn(generator, 'render').mockResolvedValueOnce('first.pdf').mockRejectedValueOnce(new Error('Temporary PDF failure'));
    const mailer = new FakeCertificateMailer();
    const service = new CertificateService(pool, new FakeShopify(), generator, mailer, 'https://certificates.example.com');
    const order = fulfilledOrder();order.line_items[0]!.quantity = 2;
    await expect(service.processFulfilledOrder(order)).rejects.toThrow('Temporary PDF failure');
    expect(mailer.sent).toHaveLength(0);
    const firstToken = (await pool.query("SELECT token FROM authenticity_certificates WHERE pdf_path='first.pdf'")).rows[0].token;
    const retried = await service.processFulfilledOrder(order);
    expect(retried).toHaveLength(3);expect(retried.map(c => c.token)).toContain(firstToken);
    expect(mailer.sent).toHaveLength(1);expect(mailer.sent[0]?.certificates).toHaveLength(3);
    expect(render).toHaveBeenCalledTimes(4);
  });

  it('creates one PDF per item and sends one order email without duplicating on retry', async () => {
    const shopify = new FakeShopify();
    const generator = new FakeGenerator();
    const certificateMailer = new FakeCertificateMailer();
    const service = new CertificateService(
      pool, shopify, generator, certificateMailer, 'https://api.circularfash.com',
      () => new Date('2026-09-04T12:00:00Z'),
    );

    const first = await service.processFulfilledOrder(fulfilledOrder());
    expect(first).toHaveLength(2);
    expect(generator.rendered).toHaveLength(2);
    expect(certificateMailer.sent).toHaveLength(1);
    expect(certificateMailer.sent[0]?.certificates).toHaveLength(2);
    expect(certificateMailer.sent[0]?.idempotencyKey).toBe('certificate-order-7001');

    const retried = await service.processFulfilledOrder(fulfilledOrder());
    expect(retried.map(certificate => certificate.token)).toEqual(first.map(certificate => certificate.token));
    expect(generator.rendered).toHaveLength(2);
    expect(certificateMailer.sent).toHaveLength(1);
    expect(shopify.updates).toHaveLength(2);
  });

  it('drains a queued webhook and exposes a privacy-safe verification page', async () => {
    const body = JSON.stringify(fulfilledOrder());
    await app.inject({
      method: 'POST', url: '/webhooks/shopify/orders-fulfilled', payload: body,
      headers: {
        'content-type': 'application/json',
        'x-shopify-hmac-sha256': signature(body),
        'x-shopify-webhook-id': 'webhook-worker',
        'x-shopify-topic': 'orders/fulfilled',
      },
    });
    const service = new CertificateService(
      pool, new FakeShopify(), new FakeGenerator(), new FakeCertificateMailer(),
      'https://api.circularfash.com', () => new Date('2026-09-04T12:00:00Z'),
    );
    expect(await processNextCertificateJob(pool, service)).toBe(true);
    expect(await processNextCertificateJob(pool, service)).toBe(false);
    const job = await pool.query(`SELECT status FROM shopify_webhooks WHERE webhook_id='webhook-worker'`);
    expect(job.rows[0].status).toBe('completed');
    const certificate = await pool.query(`SELECT token FROM authenticity_certificates ORDER BY created_at LIMIT 1`);
    const page = await app.inject({ method: 'GET', url: `/certificates/${certificate.rows[0].token}` });
    expect(page.statusCode).toBe(200);
    expect(page.body).toContain('Certificate of Authenticity');
    expect(page.body).toContain('Maya Jacket');
    expect(page.body).not.toContain('buyer@example.se');
  });
});
