import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getTestPool, truncateAll } from './helpers.js';
import { requestOtp, verifyOtp } from '../src/auth/otp.js';
import type { Mailer } from '../src/mailer.js';
import type pg from 'pg';

let pool: pg.Pool;
beforeAll(async () => { pool = await getTestPool(); });
afterAll(async () => { await pool.end(); });
beforeEach(async () => { await truncateAll(pool); });

function capturingMailer() {
  const sent: { email: string; code: string }[] = [];
  const mailer: Mailer = { async sendOtp(email, code) { sent.push({ email, code }); } };
  return { mailer, sent };
}
const now = () => new Date('2026-08-30T19:00:00Z');

describe('requestOtp', () => {
  it('emails a 6-digit code and stores only its hash', async () => {
    const { mailer, sent } = capturingMailer();
    const res = await requestOtp(pool, 'a@b.se', mailer, now);
    expect(res.ok).toBe(true);
    expect(sent[0]!.code).toMatch(/^\d{6}$/);
    const { rows } = await pool.query(`SELECT code_hash FROM otp_codes WHERE email='a@b.se'`);
    expect(rows[0].code_hash).not.toContain(sent[0]!.code);
  });

  it('rate-limits the 4th request in 10 minutes', async () => {
    const { mailer } = capturingMailer();
    for (let i = 0; i < 3; i++) expect((await requestOtp(pool, 'a@b.se', mailer, now)).ok).toBe(true);
    expect(await requestOtp(pool, 'a@b.se', mailer, now)).toEqual({ ok: false, reason: 'rate_limited' });
  });

  it('serializes concurrent requests so the rate limit holds under a race', async () => {
    const { mailer } = capturingMailer();
    const results = await Promise.all(
      Array.from({ length: 6 }, () => requestOtp(pool, 'a@b.se', mailer, now)),
    );
    expect(results.filter((r) => r.ok).length).toBe(3);
    const { rows } = await pool.query(`SELECT count(*)::int AS n FROM otp_codes WHERE email='a@b.se'`);
    expect(rows[0].n).toBe(3);
  });
});

describe('verifyOtp', () => {
  it('accepts the right code once, then never again', async () => {
    const { mailer, sent } = capturingMailer();
    await requestOtp(pool, 'a@b.se', mailer, now);
    expect(await verifyOtp(pool, 'a@b.se', sent[0]!.code, now)).toEqual({ ok: true });
    expect((await verifyOtp(pool, 'a@b.se', sent[0]!.code, now)).ok).toBe(false);
  });

  it('rejects a wrong code and an expired code', async () => {
    const { mailer, sent } = capturingMailer();
    await requestOtp(pool, 'a@b.se', mailer, now);
    expect(await verifyOtp(pool, 'a@b.se', '000000', now)).toEqual({ ok: false, reason: 'invalid' });
    const later = () => new Date('2026-08-30T19:11:00Z');
    expect(await verifyOtp(pool, 'a@b.se', sent[0]!.code, later)).toEqual({ ok: false, reason: 'expired' });
  });

  it('locks a code after 5 wrong attempts', async () => {
    const { mailer, sent } = capturingMailer();
    await requestOtp(pool, 'a@b.se', mailer, now);
    for (let i = 0; i < 5; i++) await verifyOtp(pool, 'a@b.se', '000000', now);
    expect(await verifyOtp(pool, 'a@b.se', sent[0]!.code, now)).toEqual({ ok: false, reason: 'too_many_attempts' });
  });
});
