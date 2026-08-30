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
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');

  // Atomically check rate limit and insert: INSERT succeeds only if count < MAX_REQUESTS_PER_WINDOW
  const { rows } = await pool.query(
    `INSERT INTO otp_codes (email, code_hash, expires_at, created_at)
     SELECT $1, $2, $3, $4
     WHERE (SELECT count(*)::int FROM otp_codes WHERE email=$1 AND created_at > $5) < $6
     RETURNING id`,
    [email, hashToken(code), new Date(now().getTime() + OTP_TTL_MS), now(), windowStart, MAX_REQUESTS_PER_WINDOW],
  );

  if (rows.length === 0) return { ok: false, reason: 'rate_limited' };

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
  if (row.expires_at < now()) return { ok: false, reason: 'expired' };
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false, reason: 'too_many_attempts' };

  const codeHash = hashToken(code);

  if (row.code_hash === codeHash) {
    // Correct code: atomically mark consumed (only if not already consumed)
    const { rows: consumeRows } = await pool.query(
      `UPDATE otp_codes SET consumed_at=$2 WHERE id=$1 AND consumed_at IS NULL RETURNING id`,
      [row.id, now()],
    );
    if (consumeRows.length > 0) return { ok: true };
    // Already consumed by another request
    return { ok: false, reason: 'invalid' };
  }

  // Wrong code: atomically increment attempts (only if under limit and not consumed)
  const { rows: updateRows } = await pool.query(
    `UPDATE otp_codes SET attempts = attempts + 1
     WHERE id=$1 AND attempts < $2 AND consumed_at IS NULL
     RETURNING attempts`,
    [row.id, MAX_ATTEMPTS],
  );

  if (updateRows.length === 0) {
    // Couldn't increment: either hit limit or became consumed
    const { rows: checkRows } = await pool.query(
      `SELECT consumed_at FROM otp_codes WHERE id=$1`,
      [row.id],
    );
    if (checkRows[0]?.consumed_at) return { ok: false, reason: 'invalid' };
    return { ok: false, reason: 'too_many_attempts' };
  }

  return { ok: false, reason: 'invalid' };
}
