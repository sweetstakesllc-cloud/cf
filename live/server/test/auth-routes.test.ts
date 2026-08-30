import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getTestPool, truncateAll } from './helpers.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import type { Mailer } from '../src/mailer.js';
import type pg from 'pg';
import type { FastifyInstance } from 'fastify';

let pool: pg.Pool;
let app: FastifyInstance;
const sent: { email: string; code: string }[] = [];
const mailer: Mailer = { async sendOtp(email, code) { sent.push({ email, code }); } };

beforeAll(async () => {
  pool = await getTestPool();
  app = buildApp({
    config: loadConfig({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgres://cf:cf@localhost:5433/cf_live',
      COOKIE_SECRET: 'test-cookie-secret-at-least-32-chars!!',
    }),
    pool, mailer,
  });
});
afterAll(async () => { await app.close(); await pool.end(); });
beforeEach(async () => { await truncateAll(pool); sent.length = 0; });

async function login(email = 'a@b.se'): Promise<string> {
  await app.inject({ method: 'POST', url: '/auth/request-code', payload: { email } });
  const code = sent.at(-1)!.code;
  const res = await app.inject({ method: 'POST', url: '/auth/verify', payload: { email, code } });
  expect(res.statusCode).toBe(200);
  return res.cookies.find(c => c.name === 'cf_session')!.value;
}

describe('auth flow', () => {
  it('request-code → verify sets a session cookie and creates the customer', async () => {
    const token = await login();
    expect(token.length).toBeGreaterThan(20);
    const { rows } = await pool.query(`SELECT email FROM customers`);
    expect(rows[0].email).toBe('a@b.se');
  });

  it('verify with a wrong code is 401 and sets no cookie', async () => {
    await app.inject({ method: 'POST', url: '/auth/request-code', payload: { email: 'a@b.se' } });
    const res = await app.inject({ method: 'POST', url: '/auth/verify', payload: { email: 'a@b.se', code: '000000' } });
    expect(res.statusCode).toBe(401);
    expect(res.cookies.find(c => c.name === 'cf_session')).toBeUndefined();
  });

  it('/auth/me reflects the session; logout kills it', async () => {
    const token = await login();
    const me = await app.inject({ method: 'GET', url: '/auth/me', cookies: { cf_session: token } });
    expect(me.json()).toEqual({ email: 'a@b.se', bidReady: false });
    await app.inject({ method: 'POST', url: '/auth/logout', cookies: { cf_session: token } });
    const after = await app.inject({ method: 'GET', url: '/auth/me', cookies: { cf_session: token } });
    expect(after.statusCode).toBe(401);
  });

  it('/auth/me without a cookie is 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/auth/me' });
    expect(res.statusCode).toBe(401);
  });

  it('rate-limited request-code returns 429', async () => {
    for (let i = 0; i < 3; i++) await app.inject({ method: 'POST', url: '/auth/request-code', payload: { email: 'a@b.se' } });
    const res = await app.inject({ method: 'POST', url: '/auth/request-code', payload: { email: 'a@b.se' } });
    expect(res.statusCode).toBe(429);
  });
});
