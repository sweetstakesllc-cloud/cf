import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getTestPool, truncateAll } from './helpers.js';
import type pg from 'pg';
import {
  createStream, endStream, getActiveStreamId, addItem, pinItem, getPublicState, maskEmail,
} from '../src/live/engine.js';

let pool: pg.Pool;
beforeAll(async () => { pool = await getTestPool(); });
afterAll(async () => { await pool.end(); });
beforeEach(async () => { await truncateAll(pool); });

const now = () => new Date('2026-08-30T19:00:00Z');

describe('live-commerce schema', () => {
  it('has the five tables with expected constraints', async () => {
    const { rows } = await pool.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND table_name IN ('streams','stream_items','bids','charges','events')`);
    expect(rows.map(r => r.table_name).sort()).toEqual(['bids','charges','events','stream_items','streams']);
    await pool.query(`INSERT INTO streams (title) VALUES ('Friday Big Drop')`);
    const s = await pool.query(`SELECT status FROM streams`);
    expect(s.rows[0].status).toBe('live');
    await expect(pool.query(
      `INSERT INTO stream_items (stream_id, position, title, mode)
       SELECT id, 1, 'x', 'raffle' FROM streams`)).rejects.toThrow(); // mode CHECK
  });
});

describe('streams and items', () => {
  it('creates one live stream at a time', async () => {
    const { streamId } = await createStream(pool, 'Friday Big Drop');
    expect(await getActiveStreamId(pool)).toBe(streamId);
    await expect(createStream(pool, 'Second')).rejects.toThrow('stream_already_live');
    await endStream(pool, streamId, now);
    expect(await getActiveStreamId(pool)).toBeNull();
  });

  it('queues items with ascending positions and validates mode prices', async () => {
    const { streamId } = await createStream(pool, 'S');
    await addItem(pool, streamId, { title: 'Gucci Jackie', mode: 'auction', startingBidOre: 150000 });
    await addItem(pool, streamId, { title: 'Burberry Polo', mode: 'buy_now', buyNowPriceOre: 90000 });
    await expect(addItem(pool, streamId, { title: 'x', mode: 'auction' })).rejects.toThrow('invalid_item');
    await expect(addItem(pool, streamId, { title: 'x', mode: 'buy_now' })).rejects.toThrow('invalid_item');
    const { rows } = await pool.query(`SELECT position FROM stream_items ORDER BY position`);
    expect(rows.map(r => r.position)).toEqual([1, 2]);
  });

  it('pins one item at a time, returning the previous to queued', async () => {
    const { streamId } = await createStream(pool, 'S');
    const a = await addItem(pool, streamId, { title: 'A', mode: 'auction', startingBidOre: 1000 });
    const b = await addItem(pool, streamId, { title: 'B', mode: 'auction', startingBidOre: 1000 });
    await pinItem(pool, a.itemId, now);
    await pinItem(pool, b.itemId, now);
    const { rows } = await pool.query(`SELECT id, state FROM stream_items`);
    const states = Object.fromEntries(rows.map(r => [r.id, r.state]));
    expect(states[a.itemId]).toBe('queued');
    expect(states[b.itemId]).toBe('pinned');
  });

  it('exposes public state with masked winner and queue length', async () => {
    expect(maskEmail('anna@example.se')).toBe('a***');
    const { streamId } = await createStream(pool, 'S');
    const a = await addItem(pool, streamId, { title: 'A', mode: 'auction', startingBidOre: 1000 });
    await addItem(pool, streamId, { title: 'B', mode: 'buy_now', buyNowPriceOre: 5000 });
    await pinItem(pool, a.itemId, now);
    const state = await getPublicState(pool);
    expect(state.stream!.title).toBe('S');
    expect(state.pinned!.itemId).toBe(a.itemId);
    expect(state.pinned!.bidCount).toBe(0);
    expect(state.queueLength).toBe(1);
  });

  it('regression: shows newly pinned item even if previous was sold', async () => {
    const clock1 = () => new Date('2026-08-30T19:00:00Z');
    const clock2 = () => new Date('2026-08-30T19:00:10Z');
    const { streamId } = await createStream(pool, 'Stream');
    const a = await addItem(pool, streamId, { title: 'Item A', mode: 'auction', startingBidOre: 1000 });
    const b = await addItem(pool, streamId, { title: 'Item B', mode: 'auction', startingBidOre: 2000 });
    await pinItem(pool, b.itemId, clock1);
    await pool.query(`UPDATE stream_items SET state='charged' WHERE id=$1`, [b.itemId]);
    await pinItem(pool, a.itemId, clock2);
    const state = await getPublicState(pool);
    expect(state.pinned!.itemId).toBe(a.itemId);
  });

  it('refuses to re-pin an item that is already charged', async () => {
    const { streamId } = await createStream(pool, 'S');
    const a = await addItem(pool, streamId, { title: 'A', mode: 'auction', startingBidOre: 1000 });
    await pool.query(`UPDATE stream_items SET state='charged' WHERE id=$1`, [a.itemId]);
    await expect(pinItem(pool, a.itemId, now)).rejects.toThrow('cannot_pin');
  });
});
