import { createHmac } from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { FakePaymentGateway } from '../src/billing/gateway.js';
import type { Mailer } from '../src/mailer.js';
import { CertificateService } from '../src/certificates/service.js';
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

describe('Shopify fulfilled-order webhook', () => {
  it('verifies HMAC, queues once, and acknowledges duplicate deliveries', async () => {
    const body = JSON.stringify(fulfilledOrder());
    const headers = {
      'content-type': 'application/json',
      'x-shopify-hmac-sha256': signature(body),
      'x-shopify-webhook-id': 'webhook-1',
      'x-shopify-topic': 'orders/fulfilled',
      'x-shopify-shop-domain': 'circular-fash.myshopify.com',
    };
    const first = await app.inject({ method: 'POST', url: '/webhooks/shopify/orders-fulfilled', headers, payload: body });
    expect(first.statusCode).toBe(202);
    expect(first.json()).toEqual({ received: true, duplicate: false });
    const duplicate = await app.inject({ method: 'POST', url: '/webhooks/shopify/orders-fulfilled', headers, payload: body });
    expect(duplicate.statusCode).toBe(202);
    expect(duplicate.json()).toEqual({ received: true, duplicate: true });
    const { rows } = await pool.query(`SELECT count(*)::int AS count FROM shopify_webhooks`);
    expect(rows[0].count).toBe(1);
  });

  it('rejects a forged delivery', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/shopify/orders-fulfilled',
      headers: {
        'content-type': 'application/json',
        'x-shopify-hmac-sha256': 'not-valid',
        'x-shopify-webhook-id': 'webhook-2',
        'x-shopify-topic': 'orders/fulfilled',
      },
      payload: JSON.stringify(fulfilledOrder()),
    });
    expect(response.statusCode).toBe(401);
  });
});

describe('certificate processing', () => {
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
