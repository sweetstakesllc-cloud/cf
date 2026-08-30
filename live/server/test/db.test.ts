import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestPool, truncateAll } from './helpers.js';
import type pg from 'pg';

let pool: pg.Pool;
beforeAll(async () => { pool = await getTestPool(); });
afterAll(async () => { await pool.end(); });

describe('migrations + schema', () => {
  it('creates the foundation tables and enforces email uniqueness', async () => {
    await truncateAll(pool);
    await pool.query(`INSERT INTO customers (email) VALUES ('a@b.se')`);
    await expect(pool.query(`INSERT INTO customers (email) VALUES ('a@b.se')`)).rejects.toThrow();
    const { rows } = await pool.query(`SELECT bid_ready FROM customers WHERE email='a@b.se'`);
    expect(rows[0].bid_ready).toBe(false);
  });

  it('is idempotent — running migrations again applies nothing', async () => {
    const { runMigrations } = await import('../scripts/migrate.js');
    expect(await runMigrations(pool)).toEqual([]);
  });
});
