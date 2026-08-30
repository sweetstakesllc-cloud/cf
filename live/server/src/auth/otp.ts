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

  // Serialize per-email with advisory lock to prevent concurrent bypass of rate limit
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Lock prevents other transactions with same email from proceeding
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [email]);

    // Now check count while holding lock
    const { rows: countRows } = await client.query(
      `SELECT count(*)::int AS n FROM otp_codes WHERE email=$1 AND created_at > $2`,
      [email, windowStart],
    );

    if (countRows[0].n >= MAX_REQUESTS_PER_WINDOW) {
      await client.query('ROLLBACK');
      return { ok: false, reason: 'rate_limited' };
    }

    // Insert while holding lock
    await client.query(
      `INSERT INTO otp_codes (email, code_hash, expires_at, created_at) VALUES ($1, $2, $3, $4)`,
      [email, hashToken(code), new Date(now().getTime() + OTP_TTL_MS), now()],
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

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
