import { createHash, randomInt } from 'node:crypto';
import type pg from 'pg';
import type { Mailer } from '../mailer.js';

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 3;
const MAX_ATTEMPTS = 5;

export function hashToken(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export async function requestOtp(
  pool: pg.Pool, email: string, mailer: Mailer, now: () => Date,
): Promise<{ ok: true } | { ok: false; reason: 'rate_limited' }> {
  const windowStart = new Date(now().getTime() - OTP_TTL_MS);
  const { rows } = await pool.query(
    `SELECT count(*)::int AS n FROM otp_codes WHERE email=$1 AND created_at > $2`,
    [email, windowStart],
  );
  if (rows[0].n >= MAX_REQUESTS_PER_WINDOW) return { ok: false, reason: 'rate_limited' };

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await pool.query(
    `INSERT INTO otp_codes (email, code_hash, expires_at, created_at) VALUES ($1, $2, $3, $4)`,
    [email, hashToken(code), new Date(now().getTime() + OTP_TTL_MS), now()],
  );
  await mailer.sendOtp(email, code);
  return { ok: true };
}

export async function verifyOtp(
  pool: pg.Pool, email: string, code: string, now: () => Date,
): Promise<{ ok: true } | { ok: false; reason: 'invalid' | 'expired' | 'too_many_attempts' }> {
  const { rows } = await pool.query(
    `SELECT id, code_hash, expires_at, attempts, consumed_at FROM otp_codes
     WHERE email=$1 ORDER BY created_at DESC LIMIT 1`,
    [email],
  );
  const row = rows[0];
  if (!row || row.consumed_at) return { ok: false, reason: 'invalid' };
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false, reason: 'too_many_attempts' };
  if (row.expires_at < now()) return { ok: false, reason: 'expired' };
  if (row.code_hash !== hashToken(code)) {
    await pool.query(`UPDATE otp_codes SET attempts = attempts + 1 WHERE id=$1`, [row.id]);
    return { ok: false, reason: 'invalid' };
  }
  await pool.query(`UPDATE otp_codes SET consumed_at=$2 WHERE id=$1`, [row.id, now()]);
  return { ok: true };
}
