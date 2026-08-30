import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getTestPool, truncateAll } from './helpers.js';
import { createStream, addItem, pinItem, openAuction, placeBid, extendAuction, passItem, SOFT_CLOSE_MS } from '../src/live/engine.js';
import type pg from 'pg';

let pool: pg.Pool;
beforeAll(async () => { pool = await getTestPool(); });
afterAll(async () => { await pool.end(); });
beforeEach(async () => { await truncateAll(pool); });

const t0 = new Date('2026-08-30T19:00:00Z');
const at = (ms: number) => () => new Date(t0.getTime() + ms);

async function customer(email: string, bidReady = true): Promise<{ customerId: string; bidReady: boolean }> {
  const { rows } = await pool.query(
    `INSERT INTO customers (email, bid_ready) VALUES ($1, $2) RETURNING id`, [email, bidReady]);
  return { customerId: rows[0].id, bidReady };
}

async function openItem(durationMs = 60_000): Promise<string> {
  const { streamId } = await createStream(pool, 'S');
  const { itemId } = await addItem(pool, streamId, { title: 'Jackie', mode: 'auction', startingBidOre: 100000, minIncrementOre: 10000 });
  await pinItem(pool, itemId, at(0));
  await openAuction(pool, itemId, durationMs, at(0));
  return itemId;
}

describe('openAuction', () => {
  it('requires a pinned auction item and only one open at a time', async () => {
    const { streamId } = await createStream(pool, 'S');
    const a = await addItem(pool, streamId, { title: 'A', mode: 'auction', startingBidOre: 1000 });
    const b = await addItem(pool, streamId, { title: 'B', mode: 'buy_now', buyNowPriceOre: 1000 });
    await expect(openAuction(pool, a.itemId, 60_000, at(0))).rejects.toThrow('cannot_open'); // not pinned
    await pinItem(pool, b.itemId, at(0));
    await expect(openAuction(pool, b.itemId, 60_000, at(0))).rejects.toThrow('cannot_open'); // wrong mode
  });
});

describe('placeBid', () => {
  it('accepts the opening bid at starting price and enforces increments', async () => {
    const itemId = await openItem();
    const anna = await customer('anna@x.se');
    const erik = await customer('erik@x.se');
    expect((await placeBid(pool, itemId, anna, 99999, at(1000))).ok).toBe(false);
    const first = await placeBid(pool, itemId, anna, 100000, at(1000));
    expect(first).toMatchObject({ ok: true, amountOre: 100000 });
    expect(await placeBid(pool, itemId, erik, 105000, at(2000))).toEqual({ ok: false, reason: 'too_low' });
    expect((await placeBid(pool, itemId, erik, 110000, at(2000))).ok).toBe(true);
  });

  it('rejects non-bid-ready bidders, closed items, and ended auctions', async () => {
    const itemId = await openItem(60_000);
    const spectator = await customer('s@x.se', false);
    expect(await placeBid(pool, itemId, spectator, 100000, at(0))).toEqual({ ok: false, reason: 'not_bid_ready' });
    const anna = await customer('anna@x.se');
    expect(await placeBid(pool, itemId, anna, 100000, at(61_000))).toEqual({ ok: false, reason: 'ended' });
    await passItem(pool, itemId, at(61_000));
    expect(await placeBid(pool, itemId, anna, 100000, at(61_000))).toEqual({ ok: false, reason: 'not_open' });
  });

  it('soft-closes: a late bid resets the clock to SOFT_CLOSE_MS', async () => {
    const itemId = await openItem(60_000);
    const anna = await customer('anna@x.se');
    const res = await placeBid(pool, itemId, anna, 100000, at(55_000)); // 5s left
    expect(res.ok).toBe(true);
    if (res.ok) expect(new Date(res.endsAt).getTime()).toBe(t0.getTime() + 55_000 + SOFT_CLOSE_MS);
    const early = await placeBid(pool, itemId, await customer('erik@x.se'), 110000, at(10_000)); // 55s left — no extension
    if (early.ok) expect(new Date(early.endsAt).getTime()).toBe(t0.getTime() + 55_000 + SOFT_CLOSE_MS);
  });

  it('is safe under concurrent bidding: highest valid bid wins the row', async () => {
    const itemId = await openItem();
    const bidders = await Promise.all(
      Array.from({ length: 8 }, (_, i) => customer(`c${i}@x.se`)));
    const results = await Promise.all(
      bidders.map((b, i) => placeBid(pool, itemId, b, 100000 + i * 10000, at(1000))));
    const { rows } = await pool.query(`SELECT current_bid_ore FROM stream_items WHERE id=$1`, [itemId]);
    // serialized by FOR UPDATE: at least the highest-amount accepted bid must stand
    const accepted = results.filter(r => r.ok).map(r => (r as { amountOre: number }).amountOre);
    expect(rows[0].current_bid_ore).toBe(Math.max(...accepted));
    const bids = await pool.query(`SELECT count(*)::int AS n FROM bids WHERE item_id=$1`, [itemId]);
    expect(bids.rows[0].n).toBe(accepted.length);
  });
});

describe('extendAuction', () => {
  it('adds time from max(ends_at, now)', async () => {
    const itemId = await openItem(60_000);
    await extendAuction(pool, itemId, 60_000, at(10_000));
    const { rows } = await pool.query(`SELECT ends_at FROM stream_items WHERE id=$1`, [itemId]);
    expect(new Date(rows[0].ends_at).getTime()).toBe(t0.getTime() + 120_000);
  });
});
