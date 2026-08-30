import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestPool } from './helpers.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { FakePaymentGateway } from '../src/billing/gateway.js';
import type { Mailer } from '../src/mailer.js';
import type pg from 'pg';
import type { FastifyInstance } from 'fastify';

let pool: pg.Pool;
let app: FastifyInstance;
const mailer: Mailer = { async sendOtp() {} };

beforeAll(async () => {
  pool = await getTestPool();
  app = buildApp({
    config: loadConfig({
      NODE_ENV: 'test', DATABASE_URL: 'postgres://cf:cf@localhost:5433/cf_live',
      COOKIE_SECRET: 'test-cookie-secret-at-least-32-chars!!',
    }),
    pool, mailer, gateway: new FakePaymentGateway(),
  });
});
afterAll(async () => { await app.close(); await pool.end(); });

describe('GET /live (viewer shell)', () => {
  it('serves the mount contract the Shopify page will copy', async () => {
    const res = await app.inject({ method: 'GET', url: '/live' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toContain('id="cf-live"');
    expect(res.body).toContain('/static/live.js');
    expect(res.body).toContain('/static/live.css');
  });
});

describe('/static assets', () => {
  it('serves the widget with a cache header', async () => {
    const res = await app.inject({ method: 'GET', url: '/static/live.js' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('javascript');
    expect(res.headers['cache-control']).toContain('max-age');
  });

  it('serves the stylesheet and 404s unknown files', async () => {
    expect((await app.inject({ method: 'GET', url: '/static/live.css' })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/static/nope.js' })).statusCode).toBe(404);
  });
});
