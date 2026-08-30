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

  it('extend and second-chance work through the host API', async () => {
    const s = await app.inject({ method: 'POST', url: '/host/streams', headers: auth, payload: { title: 'S' } });
    const { streamId } = s.json();
    const i = await app.inject({ method: 'POST', url: '/host/items', headers: auth,
      payload: { streamId, title: 'Jackie', mode: 'auction', startingBidOre: 100000 } });
    const { itemId } = i.json();
    // A second, never-pinned item stays 'queued' — the cleanest way to exercise extend's not_open 409.
    const other = await app.inject({ method: 'POST', url: '/host/items', headers: auth,
      payload: { streamId, title: 'Other', mode: 'auction', startingBidOre: 1000 } });
    await app.inject({ method: 'POST', url: `/host/items/${itemId}/pin`, headers: auth });
    await app.inject({ method: 'POST', url: `/host/items/${itemId}/open-auction`, headers: auth, payload: { durationSec: 60 } });

    const extend = await app.inject({ method: 'POST', url: `/host/items/${itemId}/extend`, headers: auth, payload: { extraSec: 60 } });
    expect(extend.statusCode).toBe(200);
    expect(extend.json()).toEqual({ ok: true });

    const extendOther = await app.inject({
      method: 'POST', url: `/host/items/${other.json().itemId}/extend`, headers: auth, payload: { extraSec: 60 },
    });
    expect(extendOther.statusCode).toBe(409);

    // Drive a real failed-then-second-chance charge through the engine (bids + settle), then
    // exercise /host/items/:id/second-chance the same way the host would.
    const { placeBid, settleDueAuctions } = await import('../src/live/engine.js');
    const { rows: annaRows } = await pool.query(
      `INSERT INTO customers (email, bid_ready, stripe_customer_id, default_payment_method_id)
       VALUES ('anna@x.se', true, 'cus_anna', 'pm_anna') RETURNING id`);
    const { rows: erikRows } = await pool.query(
      `INSERT INTO customers (email, bid_ready, stripe_customer_id, default_payment_method_id)
       VALUES ('erik@x.se', true, 'cus_erik', 'pm_erik') RETURNING id`);
    await placeBid(pool, itemId, { customerId: erikRows[0].id, bidReady: true }, 100000,
      () => new Date(now().getTime() + 1000));
    await placeBid(pool, itemId, { customerId: annaRows[0].id, bidReady: true }, 120000,
      () => new Date(now().getTime() + 2000));

    gateway.failNextCharge = true;
    await settleDueAuctions(pool, gateway, () => new Date(now().getTime() + 200_000));
    const failed = await pool.query(`SELECT state FROM stream_items WHERE id=$1`, [itemId]);
    expect(failed.rows[0].state).toBe('payment_failed');

    const sc = await app.inject({ method: 'POST', url: `/host/items/${itemId}/second-chance`, headers: auth });
    expect(sc.statusCode).toBe(200);
    expect(sc.json()).toEqual({ ok: true, charged: true });

    const st = await app.inject({ method: 'GET', url: '/host/state', headers: auth });
    expect(st.json().pinned.winnerEmail).toBe('erik@x.se');
    expect(st.json().pinned.chargeStatus).toBe('succeeded');

    const sc2 = await app.inject({ method: 'POST', url: `/host/items/${itemId}/second-chance`, headers: auth });
    expect(sc2.statusCode).toBe(409);
  });

  it('retry-charge recovers an item stranded in won by a non-card gateway error', async () => {
    const s = await app.inject({ method: 'POST', url: '/host/streams', headers: auth, payload: { title: 'S' } });
    const { streamId } = s.json();
    const i = await app.inject({ method: 'POST', url: '/host/items', headers: auth,
      payload: { streamId, title: 'Jackie', mode: 'auction', startingBidOre: 100000 } });
    const { itemId } = i.json();

    const { rows } = await pool.query(
      `INSERT INTO customers (email, bid_ready, stripe_customer_id, default_payment_method_id)
       VALUES ('anna@x.se', true, 'cus_anna', 'pm_anna') RETURNING id`);
    // Manufacture an item stranded in 'won' — as if settle's post-commit charge step threw
    // (Stripe timeout, etc.) before it could transition the row to charged/payment_failed.
    await pool.query(
      `UPDATE stream_items SET state='won', winner_id=$1, winning_amount_ore=90000 WHERE id=$2`,
      [rows[0].id, itemId]);

    const retry = await app.inject({ method: 'POST', url: `/host/items/${itemId}/retry-charge`, headers: auth });
    expect(retry.statusCode).toBe(200);
    expect(retry.json()).toEqual({ ok: true, charged: true });

    const st = await app.inject({ method: 'GET', url: '/host/state', headers: auth });
    expect(st.json().pinned.state).toBe('charged');
    expect(st.json().pinned.chargeStatus).toBe('succeeded');

    const retry2 = await app.inject({ method: 'POST', url: `/host/items/${itemId}/retry-charge`, headers: auth });
    expect(retry2.statusCode).toBe(409);
    expect(retry2.json()).toEqual({ error: 'not_won' });
  });
});

describe('GET /host', () => {
  it('serves the console page without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/host' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toContain('Circular Fash');
  });
});

describe('POST /host/streams playbackUrl', () => {
  it('threads the playback URL through to public state', async () => {
    const s = await app.inject({ method: 'POST', url: '/host/streams', headers: auth,
      payload: { title: 'S', playbackUrl: 'https://stream.mux.com/abc.m3u8' } });
    expect(s.statusCode).toBe(201);
    const state = await app.inject({ method: 'GET', url: '/live/state' });
    expect(state.json().stream.playbackUrl).toBe('https://stream.mux.com/abc.m3u8');
  });

  it('rejects a non-URL playbackUrl', async () => {
    const s = await app.inject({ method: 'POST', url: '/host/streams', headers: auth,
      payload: { title: 'S', playbackUrl: 'not-a-url' } });
    expect(s.statusCode).toBe(400);
  });
});

describe('POST /host/mute', () => {
  it('mutes by fromId with bearer auth', async () => {
    expect((await app.inject({ method: 'POST', url: '/host/mute', payload: { fromId: 'deadbeef' } })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/host/mute', headers: auth, payload: {} })).statusCode).toBe(400);
    const ok = await app.inject({ method: 'POST', url: '/host/mute', headers: auth, payload: { fromId: 'deadbeef' } });
    expect(ok.statusCode).toBe(200);
    expect(app.hub.isMuted('deadbeef')).toBe(true);
  });
});
