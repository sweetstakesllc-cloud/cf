import Fastify from 'fastify';
import pg from 'pg';
import type {CertificateMailer,ShopifyFulfilledOrder} from '../src/certificates/types.js';
import {afterAll,beforeAll,beforeEach,describe,expect,it,vi} from 'vitest';
import {runMigrations} from '../scripts/migrate.js';
import {registerCertificateRequestRoutes,processNextCertificateRequest,processNextReviewNotification,requestEligibility,type RequestOrder} from '../src/certificates/requests.js';
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
const app=Fastify();
const baseUrl='https://certificates.example.com';
const order:RequestOrder={id:'gid://shopify/Order/3324',name:'#3324',email:'buyer@example.com',cancelledAt:null,
 displayFinancialStatus:'PAID',displayFulfillmentStatus:'FULFILLED',lineItems:{pageInfo:{hasNextPage:false},nodes:[{
 id:'gid://shopify/LineItem/44',title:'Jacket',vendor:'Brand',sku:'SKU',quantity:1,currentQuantity:1,product:{id:'gid://shopify/Product/55'}}]}};
const send=vi.fn(async(_input:Parameters<CertificateMailer['sendCertificateEmail']>[0])=>{});
const generate=vi.fn(async(_order:ShopifyFulfilledOrder)=>[{token:'token',certificateNumber:'CF-TEST',orderName:'#3324',productTitle:'Jacket',brand:'Brand',sku:'SKU',imageUrls:[],authenticationPartner:null,authenticationReportNumber:null,issuedAt:new Date(),pdfPath:'token.pdf',status:'active' as const}]);
const deps={findOrder:vi.fn(async()=>order as RequestOrder|null),service:{processFulfilledOrder:generate},mailer:{sendCertificateEmail:send},baseUrl};
const submit=(payload:any={orderNumber:'3324',email:'buyer@example.com'},ip='127.0.0.1')=>app.inject({method:'POST',url:'/certificate-requests',remoteAddress:ip,payload});
beforeAll(async()=>{if(!process.env.DATABASE_URL?.includes(':55439/'))throw Error('Use isolated test database on port 55439');await runMigrations(pool);registerCertificateRequestRoutes(app,pool,baseUrl,'test-rate-secret');});
beforeEach(async()=>{await pool.query('TRUNCATE certificate_requests,certificate_request_limits,authenticity_certificates');vi.clearAllMocks();deps.findOrder.mockResolvedValue(structuredClone(order));generate.mockResolvedValue([{token:'token',certificateNumber:'CF-TEST',orderName:'#3324',productTitle:'Jacket',brand:'Brand',sku:'SKU',imageUrls:[],authenticationPartner:null,authenticationReportNumber:null,issuedAt:new Date(),pdfPath:'token.pdf',status:'active'}]);});
afterAll(async()=>{await app.close();await pool.end();});
describe('past-order certificate requests',()=>{
 it('deduplicates simultaneous normalized requests without exposing certificates',async()=>{
 const responses=await Promise.all([submit(),submit({orderNumber:'#3324',email:'BUYER@example.com'})]);
 expect(responses.every(r=>r.statusCode===202)).toBe(true);expect(responses[0].body).not.toContain('token');
 expect((await pool.query('SELECT * FROM certificate_requests')).rowCount).toBe(1);
 });
 it('sends to the order email and omits email from generation to prevent duplicate delivery',async()=>{
 await submit();expect(await processNextCertificateRequest(pool,deps)).toBe(true);
 expect(generate.mock.calls[0]![0]).not.toHaveProperty('email');expect(send).toHaveBeenCalledOnce();
 expect(send.mock.calls[0]![0]).toMatchObject({email:'buyer@example.com'});
 expect((await pool.query('SELECT status FROM certificate_requests')).rows[0].status).toBe('sent');
 expect(await processNextCertificateRequest(pool,deps)).toBe(false);
 });
 it('rejects a mismatched email without issuing or sending',async()=>{
 await submit({orderNumber:'3324',email:'other@example.com'});await processNextCertificateRequest(pool,deps);
 expect(generate).not.toHaveBeenCalled();expect(send).not.toHaveBeenCalled();
 expect((await pool.query('SELECT status FROM certificate_requests')).rows[0].status).toBe('rejected');
 });
 it('retains inaccessible historical orders for review',async()=>{
 deps.findOrder.mockResolvedValue(null);await submit();await processNextCertificateRequest(pool,deps);
 expect((await pool.query('SELECT status,reason FROM certificate_requests')).rows[0]).toEqual({status:'needs_review',reason:'order_not_accessible'});expect(send).not.toHaveBeenCalled();
 });
 it('does not issue refunded, cancelled, unfulfilled, removed, deleted or multiple-quantity items',()=>{
 for(const modified of [{...order,cancelledAt:'2026-01-01'}, {...order,displayFinancialStatus:'REFUNDED'}, {...order,displayFulfillmentStatus:'UNFULFILLED'},
 ...[{currentQuantity:0},{product:null},{quantity:2}].map(change=>({...order,lineItems:{...order.lineItems,nodes:[{...order.lineItems.nodes[0]!,...change}]}}))])
 expect(requestEligibility(modified,'#3324','buyer@example.com')).not.toBeNull();
 });
 it('retries provider failures with the same email idempotency key',async()=>{
 send.mockRejectedValueOnce(new Error('Provider unavailable'));await submit();await processNextCertificateRequest(pool,deps);
 const key=send.mock.calls[0]![0].idempotencyKey;await pool.query("UPDATE certificate_requests SET next_attempt_at=now()");
 await processNextCertificateRequest(pool,deps);expect(send.mock.calls[1]![0].idempotencyKey).toBe(key);
 });
 it('limits repeated email requests across IP addresses',async()=>{
 for(let i=0;i<5;i++)expect((await submit(undefined,`10.0.0.${i+1}`)).statusCode).toBe(202);
 expect((await submit(undefined,'10.0.0.20')).statusCode).toBe(429);
 });
 it('rejects cross-origin requests and ignores honeypot submissions',async()=>{
 expect((await app.inject({method:'POST',url:'/certificate-requests',headers:{origin:'https://other.example'},payload:{orderNumber:'3324',email:'buyer@example.com'}})).statusCode).toBe(403);
 expect((await submit({orderNumber:'3324',email:'buyer@example.com',website:'spam'})).statusCode).toBe(202);
 expect((await pool.query('SELECT * FROM certificate_requests')).rowCount).toBe(0);
 });
 it('claims one request once across simultaneous workers',async()=>{
 await submit();const results=await Promise.all([processNextCertificateRequest(pool,deps),processNextCertificateRequest(pool,deps)]);
 expect(results.filter(Boolean)).toHaveLength(1);expect(send).toHaveBeenCalledOnce();
 });
 it('notifies staff once for historical review and retries a failed notification',async()=>{
 deps.findOrder.mockResolvedValue(null);await submit();await processNextCertificateRequest(pool,deps);
 const notify=vi.fn(async(_input:unknown)=>{}).mockRejectedValueOnce(new Error('Temporary failure'));
 await processNextReviewNotification(pool,notify);expect((await pool.query('SELECT review_notified_at FROM certificate_requests')).rows[0].review_notified_at).toBeNull();
 await pool.query('UPDATE certificate_requests SET review_next_attempt_at=now()');await processNextReviewNotification(pool,notify);
 expect(await processNextReviewNotification(pool,notify)).toBe(false);expect(notify).toHaveBeenCalledTimes(2);
 });
 it('serves an accessible form without order or certificate details',async()=>{
 const page=await app.inject('/request');expect(page.statusCode).toBe(200);expect(page.body).toContain('Email used at checkout');expect(page.body).toContain('role="status"');
 });
});
