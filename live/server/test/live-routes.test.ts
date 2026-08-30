import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getTestPool, truncateAll } from './helpers.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { FakePaymentGateway } from '../src/billing/gateway.js';
import { createStream, addItem, pinItem, openAuction } from '../src/live/engine.js';
import type { Mailer } from '../src/mailer.js';
import type pg from 'pg';
import type { FastifyInstance } from 'fastify';

let pool: pg.Pool;
let app: FastifyInstance;
let gateway: FakePaymentGateway;
const sent: { email: string; code: string }[] = [];
const mailer: Mailer = { async sendOtp(email, code) { sent.push({ email, code }); } };
const now = () => new Date('2026-08-30T19:00:00Z');

beforeAll(async () => { pool = await getTestPool(); });
afterAll(async () => { if (app) await app.close(); await pool.end(); });
beforeEach(async () => {
  await truncateAll(pool); sent.length = 0;
  gateway = new FakePaymentGateway();
  if (app) await app.close();
  app = buildApp({
    config: loadConfig({
      NODE_ENV: 'test', DATABASE_URL: 'postgres://cf:cf@localhost:5433/cf_live',
      COOKIE_SECRET: 'test-cookie-secret-at-least-32-chars!!',
    }),
    pool, mailer, gateway, now,
  });
});

async function login(email = 'anna@x.se', makeReady = true): Promise<string> {
  await app.inject({ method: 'POST', url: '/auth/request-code', payload: { email } });
  const res = await app.inject({ method: 'POST', url: '/auth/verify', payload: { email, code: sent.at(-1)!.code } });
  if (makeReady) await pool.query(
    `UPDATE customers SET bid_ready=true, stripe_customer_id='cus_x', default_payment_method_id='pm_x' WHERE email=$1`, [email]);
  return res.cookies.find(c => c.name === 'cf_session')!.value;
}

async function openAuctionItem(): Promise<string> {
  const { streamId } = await createStream(pool, 'S');
  const { itemId } = await addItem(pool, streamId, { title: 'Jackie', mode: 'auction', startingBidOre: 100000 });
  await pinItem(pool, itemId, now);
  await openAuction(pool, itemId, 60_000, now);
  return itemId;
}

describe('GET /live/state', () => {
  it('is public and returns the snapshot', async () => {
    await openAuctionItem();
    const res = await app.inject({ method: 'GET', url: '/live/state' });
    expect(res.statusCode).toBe(200);
    expect(res.json().pinned.state).toBe('auction_open');
  });
});

describe('POST /live/bid', () => {
  it('requires auth and bid-readiness', async () => {
    const itemId = await openAuctionItem();
    expect((await app.inject({ method: 'POST', url: '/live/bid', payload: { itemId, amountOre: 100000 } })).statusCode).toBe(401);
    const notReady = await login('n@x.se', false);
    const res = await app.inject({ method: 'POST', url: '/live/bid', cookies: { cf_session: notReady }, payload: { itemId, amountOre: 100000 } });
    expect(res.statusCode).toBe(403);
  });

  it('accepts a valid bid and 409s auction-state rejections', async () => {
    const itemId = await openAuctionItem();
    const token = await login();
    const ok = await app.inject({ method: 'POST', url: '/live/bid', cookies: { cf_session: token }, payload: { itemId, amountOre: 100000 } });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({ ok: true, amountOre: 100000 });
    const low = await app.inject({ method: 'POST', url: '/live/bid', cookies: { cf_session: token }, payload: { itemId, amountOre: 100001 } });
    expect(low.statusCode).toBe(409);
    expect(low.json()).toEqual({ error: 'too_low' });
  });

  it('rejects bids above the 1,000,000 kr cap with 400', async () => {
    const itemId = await openAuctionItem();
    const token = await login();
    const res = await app.inject({
      method: 'POST', url: '/live/bid', cookies: { cf_session: token },
      payload: { itemId, amountOre: 100_000_001 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'bad_request' });
  });
});

describe('POST /live/buy', () => {
  it('claims and charges a pinned buy-now item', async () => {
    const { streamId } = await createStream(pool, 'S');
    const { itemId } = await addItem(pool, streamId, { title: 'Polo', mode: 'buy_now', buyNowPriceOre: 90000 });
    await pinItem(pool, itemId, now);
    const token = await login();
    const res = await app.inject({ method: 'POST', url: '/live/buy', cookies: { cf_session: token }, payload: { itemId } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, charged: true });
    const second = await app.inject({ method: 'POST', url: '/live/buy', cookies: { cf_session: token }, payload: { itemId } });
    expect(second.statusCode).toBe(409);
  });
});
