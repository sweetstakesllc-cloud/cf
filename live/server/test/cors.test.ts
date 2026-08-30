import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestPool } from './helpers.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { FakePaymentGateway } from '../src/billing/gateway.js';
import type { Mailer } from '../src/mailer.js';
import type pg from 'pg';
import type { FastifyInstance } from 'fastify';

let pool: pg.Pool;
const mailer: Mailer = { async sendOtp() {} };
const apps: FastifyInstance[] = [];

const SHOP = 'https://circularfash.com';

function makeApp(env: Record<string, string> = {}): FastifyInstance {
  const app = buildApp({
    config: loadConfig({
      NODE_ENV: 'test', DATABASE_URL: 'postgres://cf:cf@localhost:5433/cf_live',
      COOKIE_SECRET: 'test-cookie-secret-at-least-32-chars!!', ...env,
    }),
    pool, mailer, gateway: new FakePaymentGateway(),
  });
  apps.push(app);
  return app;
}

beforeAll(async () => { pool = await getTestPool(); });
afterAll(async () => { for (const app of apps) await app.close(); await pool.end(); });

describe('CORS for the widget origin', () => {
  it('answers preflight from a configured origin with credentials allowed', async () => {
    const app = makeApp({ WIDGET_ORIGINS: SHOP });
    const res = await app.inject({
      method: 'OPTIONS', url: '/live/state',
      headers: { origin: SHOP, 'access-control-request-method': 'GET' },
    });
    expect(res.headers['access-control-allow-origin']).toBe(SHOP);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('sends the headers on actual requests from a configured origin', async () => {
    const app = makeApp({ WIDGET_ORIGINS: `${SHOP},https://www.circularfash.com` });
    const res = await app.inject({ method: 'GET', url: '/live/state', headers: { origin: SHOP } });
    expect(res.statusCode).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(SHOP);
  });

  it('gives an unlisted origin nothing', async () => {
    const app = makeApp({ WIDGET_ORIGINS: SHOP });
    const res = await app.inject({ method: 'GET', url: '/live/state', headers: { origin: 'https://evil.example' } });
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('is entirely off when WIDGET_ORIGINS is unset', async () => {
    const app = makeApp();
    const res = await app.inject({ method: 'GET', url: '/live/state', headers: { origin: SHOP } });
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
