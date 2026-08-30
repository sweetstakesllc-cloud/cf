import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { loadConfig } from '../src/config.js';
import { buildApp } from '../src/app.js';
import { getTestPool } from './helpers.js';
import type { Mailer } from '../src/mailer.js';
import type pg from 'pg';

const baseEnv = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgres://cf:cf@localhost:5433/cf_live',
  COOKIE_SECRET: 'test-cookie-secret-at-least-32-chars!!',
};

const noopMailer: Mailer = { async sendOtp() {} };
let pool: pg.Pool;

beforeAll(async () => {
  pool = await getTestPool();
});
afterAll(async () => {
  await pool.end();
});

describe('config', () => {
  it('loads and applies defaults', () => {
    const c = loadConfig(baseEnv);
    expect(c.port).toBe(3001);
    expect(c.env).toBe('test');
    expect(c.stripeSecretKey).toBeNull();
  });

  it('rejects a missing DATABASE_URL', () => {
    expect(() => loadConfig({ ...baseEnv, DATABASE_URL: undefined })).toThrow();
  });
});

describe('healthz', () => {
  it('responds ok', async () => {
    const app = buildApp({ config: loadConfig(baseEnv), pool, mailer: noopMailer });
    try {
      const res = await app.inject({ method: 'GET', url: '/healthz' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ ok: true });
    } finally {
      await app.close();
    }
  });
});
