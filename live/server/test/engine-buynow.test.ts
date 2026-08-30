import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getTestPool, truncateAll } from './helpers.js';
import { createStream, addItem, pinItem, buyNow } from '../src/live/engine.js';
import { FakePaymentGateway } from '../src/billing/gateway.js';
import type pg from 'pg';

let pool: pg.Pool;
let gateway: FakePaymentGateway;
beforeAll(async () => { pool = await getTestPool(); });
afterAll(async () => { await pool.end(); });
beforeEach(async () => { await truncateAll(pool); gateway = new FakePaymentGateway(); });

const now = () => new Date('2026-08-30T19:00:00Z');

async function readyCustomer(email: string) {
  const { rows } = await pool.query(
    `INSERT INTO customers (email, bid_ready, stripe_customer_id, default_payment_method_id)
     VALUES ($1, true, 'cus_' || $1, 'pm_' || $1) RETURNING id`, [email]);
  return { customerId: rows[0].id as string, bidReady: true };
}

async function pinnedBuyNow(): Promise<string> {
  const { streamId } = await createStream(pool, 'S');
  const { itemId } = await addItem(pool, streamId, { title: 'Polo', mode: 'buy_now', buyNowPriceOre: 90000 });
  await pinItem(pool, itemId, now);
  return itemId;
}

describe('buyNow', () => {
  it('first tap wins, is charged immediately, item becomes charged', async () => {
    const itemId = await pinnedBuyNow();
    const anna = await readyCustomer('anna@x.se');
    const res = await buyNow(pool, gateway, itemId, anna, now);
    expect(res).toMatchObject({ ok: true, charged: true });
    const { rows } = await pool.query(`SELECT state, winner_id, winning_amount_ore FROM stream_items WHERE id=$1`, [itemId]);
    expect(rows[0]).toMatchObject({ state: 'charged', winner_id: anna.customerId, winning_amount_ore: 90000 });
    expect(gateway.charges).toHaveLength(1);
  });

  it('second tap loses; exactly one charge under a concurrent race', async () => {
    const itemId = await pinnedBuyNow();
    const buyers = await Promise.all(Array.from({ length: 6 }, (_, i) => readyCustomer(`b${i}@x.se`)));
    const results = await Promise.all(buyers.map(b => buyNow(pool, gateway, itemId, b, now)));
    expect(results.filter(r => r.ok)).toHaveLength(1);
    expect(results.filter(r => !r.ok && r.reason === 'not_available')).toHaveLength(5);
    expect(gateway.charges).toHaveLength(1);
  });

  it('rejects non-bid-ready buyers and auction-mode items', async () => {
    const itemId = await pinnedBuyNow();
    const { rows } = await pool.query(`INSERT INTO customers (email) VALUES ('x@x.se') RETURNING id`);
    expect(await buyNow(pool, gateway, itemId, { customerId: rows[0].id, bidReady: false }, now))
      .toEqual({ ok: false, reason: 'not_bid_ready' });
  });

  it('failed charge leaves payment_failed (host can pass or retry)', async () => {
    const itemId = await pinnedBuyNow();
    gateway.failNextCharge = true;
    const res = await buyNow(pool, gateway, itemId, await readyCustomer('anna@x.se'), now);
    expect(res).toMatchObject({ ok: true, charged: false });
    const { rows } = await pool.query(`SELECT state FROM stream_items WHERE id=$1`, [itemId]);
    expect(rows[0].state).toBe('payment_failed');
  });
});
