import { randomBytes } from 'node:crypto';
import type pg from 'pg';
import { hashToken } from './otp.js';

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function createSession(pool: pg.Pool, customerId: string, now: () => Date): Promise<string> {
  const token = randomBytes(24).toString('hex');
  await pool.query(
    `INSERT INTO sessions (token_hash, customer_id, expires_at, created_at) VALUES ($1, $2, $3, $4)`,
    [hashToken(token), customerId, new Date(now().getTime() + SESSION_TTL_MS), now()],
  );
  return token;
}

export async function getSession(
  pool: pg.Pool, rawToken: string, now: () => Date,
): Promise<{ customerId: string; email: string; bidReady: boolean } | null> {
  const { rows } = await pool.query(
    `SELECT s.customer_id, s.expires_at, c.email, c.bid_ready
     FROM sessions s JOIN customers c ON c.id = s.customer_id
     WHERE s.token_hash = $1`,
    [hashToken(rawToken)],
  );
  const row = rows[0];
  if (!row || row.expires_at < now()) return null;
  return { customerId: row.customer_id, email: row.email, bidReady: row.bid_ready };
}

export async function destroySession(pool: pg.Pool, rawToken: string): Promise<void> {
  await pool.query(`DELETE FROM sessions WHERE token_hash = $1`, [hashToken(rawToken)]);
}
