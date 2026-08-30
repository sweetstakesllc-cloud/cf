import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getTestPool, truncateAll } from './helpers.js';
import { createSession, getSession, destroySession } from '../src/auth/session.js';
import type pg from 'pg';

let pool: pg.Pool;
beforeAll(async () => { pool = await getTestPool(); });
afterAll(async () => { await pool.end(); });
beforeEach(async () => { await truncateAll(pool); });

const now = () => new Date('2026-08-30T19:00:00Z');

async function makeCustomer(): Promise<string> {
  const { rows } = await pool.query(`INSERT INTO customers (email) VALUES ('a@b.se') RETURNING id`);
  return rows[0].id;
}

describe('sessions', () => {
  it('round-trips a session and exposes customer fields', async () => {
    const id = await makeCustomer();
    const token = await createSession(pool, id, now);
    expect(token).toMatch(/^[0-9a-f]{48}$/);
    const s = await getSession(pool, token, now);
    expect(s).toEqual({ customerId: id, email: 'a@b.se', bidReady: false });
  });

  it('stores only a hash of the token', async () => {
    const id = await makeCustomer();
    const token = await createSession(pool, id, now);
    const { rows } = await pool.query(`SELECT token_hash FROM sessions`);
    expect(rows[0].token_hash).not.toBe(token);
  });

  it('returns null for expired sessions and after destroy', async () => {
    const id = await makeCustomer();
    const token = await createSession(pool, id, now);
    const in31Days = () => new Date('2026-09-30T19:00:01Z');
    expect(await getSession(pool, token, in31Days)).toBeNull();
    await destroySession(pool, token);
    expect(await getSession(pool, token, now)).toBeNull();
  });
});
