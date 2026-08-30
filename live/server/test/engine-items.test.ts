import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getTestPool, truncateAll } from './helpers.js';
import type pg from 'pg';

let pool: pg.Pool;
beforeAll(async () => { pool = await getTestPool(); });
afterAll(async () => { await pool.end(); });
beforeEach(async () => { await truncateAll(pool); });

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
