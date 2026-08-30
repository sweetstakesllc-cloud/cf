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
const mailer: Mailer = { async sendOtp() {} };
const HOST_PW = 'super-secret-host-pw';
const auth = { authorization: `Bearer ${HOST_PW}` };
const now = () => new Date('2026-08-30T19:00:00Z');

function makeApp(hostPassword?: string): FastifyInstance {
  return buildApp({
    config: loadConfig({
      NODE_ENV: 'test', DATABASE_URL: 'postgres://cf:cf@localhost:5433/cf_live',
      COOKIE_SECRET: 'test-cookie-secret-at-least-32-chars!!',
      ...(hostPassword ? { HOST_PASSWORD: hostPassword } : {}),
    }),
    pool, mailer, gateway, now,
  });
}

beforeAll(async () => { pool = await getTestPool(); });
afterAll(async () => { if (app) await app.close(); await pool.end(); });
beforeEach(async () => {
  await truncateAll(pool);
  gateway = new FakePaymentGateway();
  if (app) await app.close();
  app = makeApp(HOST_PW);
});

describe('host auth', () => {
  it('rejects missing/wrong bearer and 503s when disabled', async () => {
    expect((await app.inject({ method: 'POST', url: '/host/streams', payload: { title: 'S' } })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/host/streams', headers: { authorization: 'Bearer nope' }, payload: { title: 'S' } })).statusCode).toBe(401);
    const disabled = makeApp();
    expect((await disabled.inject({ method: 'POST', url: '/host/streams', headers: auth, payload: { title: 'S' } })).statusCode).toBe(503);
    await disabled.close();
  });
});

describe('host flow', () => {
  it('runs a full auction from the host API', async () => {
    const s = await app.inject({ method: 'POST', url: '/host/streams', headers: auth, payload: { title: 'Big Drop' } });
    expect(s.statusCode).toBe(201);
    const { streamId } = s.json();
    const i = await app.inject({ method: 'POST', url: '/host/items', headers: auth,
      payload: { streamId, title: 'Jackie', mode: 'auction', startingBidOre: 100000 } });
    expect(i.statusCode).toBe(201);
    const { itemId } = i.json();
    expect((await app.inject({ method: 'POST', url: `/host/items/${itemId}/pin`, headers: auth })).statusCode).toBe(200);
    const open = await app.inject({ method: 'POST', url: `/host/items/${itemId}/open-auction`, headers: auth, payload: { durationSec: 60 } });
    expect(open.statusCode).toBe(200);
    expect(open.json().endsAt).toBe(new Date(now().getTime() + 60_000).toISOString());
    const st = await app.inject({ method: 'GET', url: '/host/state', headers: auth });
    expect(st.json().pinned.state).toBe('auction_open');
    expect((await app.inject({ method: 'POST', url: `/host/items/${itemId}/pass`, headers: auth })).statusCode).toBe(200);
  });

  it('maps engine errors: second stream 409, open on queued item 409', async () => {
    await app.inject({ method: 'POST', url: '/host/streams', headers: auth, payload: { title: 'One' } });
    expect((await app.inject({ method: 'POST', url: '/host/streams', headers: auth, payload: { title: 'Two' } })).statusCode).toBe(409);
    const st = await app.inject({ method: 'GET', url: '/host/state', headers: auth });
    const streamId = st.json().stream.id;
    const i = await app.inject({ method: 'POST', url: '/host/items', headers: auth,
      payload: { streamId, title: 'X', mode: 'auction', startingBidOre: 1000 } });
    const openRes = await app.inject({ method: 'POST', url: `/host/items/${i.json().itemId}/open-auction`, headers: auth, payload: { durationSec: 60 } });
    expect(openRes.statusCode).toBe(409);
  });

  it('host state shows full winner email and queue', async () => {
    const s = await app.inject({ method: 'POST', url: '/host/streams', headers: auth, payload: { title: 'S' } });
    const { streamId } = s.json();
    const i = await app.inject({ method: 'POST', url: '/host/items', headers: auth,
      payload: { streamId, title: 'Polo', mode: 'buy_now', buyNowPriceOre: 90000 } });
    const { itemId } = i.json();
    await app.inject({ method: 'POST', url: `/host/items/${itemId}/pin`, headers: auth });
    const { rows } = await pool.query(
      `INSERT INTO customers (email, bid_ready, stripe_customer_id, default_payment_method_id)
       VALUES ('anna@x.se', true, 'cus_1', 'pm_1') RETURNING id`);
    const { buyNow } = await import('../src/live/engine.js');
    await buyNow(pool, gateway, itemId, { customerId: rows[0].id, bidReady: true }, now);
    const st = await app.inject({ method: 'GET', url: '/host/state', headers: auth });
    expect(st.json().pinned.winnerEmail).toBe('anna@x.se');
    expect(st.json().pinned.chargeStatus).toBe('succeeded');
  });
});
