import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getTestPool, truncateAll } from './helpers.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { FakePaymentGateway } from '../src/billing/gateway.js';
import type { Mailer } from '../src/mailer.js';
import type pg from 'pg';
import type { FastifyInstance } from 'fastify';

let pool: pg.Pool;
let app: FastifyInstance;
let gateway: FakePaymentGateway;
const sent: { email: string; code: string }[] = [];
const mailer: Mailer = { async sendOtp(email, code) { sent.push({ email, code }); } };

beforeAll(async () => { pool = await getTestPool(); });
afterAll(async () => { await pool.end(); });
beforeEach(async () => {
  await truncateAll(pool); sent.length = 0;
  gateway = new FakePaymentGateway();
  if (app) await app.close();
  app = buildApp({
    config: loadConfig({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgres://cf:cf@localhost:5433/cf_live',
      COOKIE_SECRET: 'test-cookie-secret-at-least-32-chars!!',
    }),
    pool, mailer, gateway,
  });
});

async function login(email = 'a@b.se'): Promise<string> {
  await app.inject({ method: 'POST', url: '/auth/request-code', payload: { email } });
  const res = await app.inject({ method: 'POST', url: '/auth/verify', payload: { email, code: sent.at(-1)!.code } });
  return res.cookies.find(c => c.name === 'cf_session')!.value;
}

describe('POST /billing/setup-intent', () => {
  it('requires auth', async () => {
    const res = await app.inject({ method: 'POST', url: '/billing/setup-intent' });
    expect(res.statusCode).toBe(401);
  });

  it('creates a gateway customer once and returns a client secret', async () => {
    const token = await login();
    const res1 = await app.inject({ method: 'POST', url: '/billing/setup-intent', cookies: { cf_session: token } });
    expect(res1.statusCode).toBe(200);
    expect(res1.json().clientSecret).toMatch(/^seti_fake_/);
    const res2 = await app.inject({ method: 'POST', url: '/billing/setup-intent', cookies: { cf_session: token } });
    expect(res2.statusCode).toBe(200);
    expect(gateway.customers.size).toBe(1); // second call reuses the stored customer id
    const { rows } = await pool.query(`SELECT stripe_customer_id FROM customers WHERE email='a@b.se'`);
    expect(rows[0].stripe_customer_id).toMatch(/^cus_fake_/);
  });
});

describe('POST /webhooks/stripe', () => {
  it('rejects a bad signature', async () => {
    const res = await app.inject({
      method: 'POST', url: '/webhooks/stripe',
      headers: { 'stripe-signature': 'nope', 'content-type': 'application/json' },
      payload: JSON.stringify({ type: 'ignored' }),
    });
    expect(res.statusCode).toBe(400);
  });

  it('marks the customer bid-ready on setup_succeeded', async () => {
    const token = await login();
    await app.inject({ method: 'POST', url: '/billing/setup-intent', cookies: { cf_session: token } });
    const { rows } = await pool.query(`SELECT stripe_customer_id FROM customers WHERE email='a@b.se'`);

    const res = await app.inject({
      method: 'POST', url: '/webhooks/stripe',
      headers: { 'stripe-signature': 'fake-valid-signature', 'content-type': 'application/json' },
      payload: JSON.stringify({
        type: 'setup_succeeded',
        gatewayCustomerId: rows[0].stripe_customer_id,
        paymentMethodId: 'pm_fake_1',
      }),
    });
    expect(res.statusCode).toBe(200);

    const me = await app.inject({ method: 'GET', url: '/auth/me', cookies: { cf_session: token } });
    expect(me.json()).toEqual({ email: 'a@b.se', bidReady: true });
  });

  it('ignores unknown events without error', async () => {
    const res = await app.inject({
      method: 'POST', url: '/webhooks/stripe',
      headers: { 'stripe-signature': 'fake-valid-signature', 'content-type': 'application/json' },
      payload: JSON.stringify({ type: 'ignored' }),
    });
    expect(res.statusCode).toBe(200);
  });
});
