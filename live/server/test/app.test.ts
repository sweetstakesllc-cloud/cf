import { describe, it, expect } from 'vitest';
import { loadConfig } from '../src/config.js';
import { buildApp } from '../src/app.js';

const baseEnv = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgres://cf:cf@localhost:5433/cf_live',
  COOKIE_SECRET: 'test-cookie-secret-at-least-32-chars!!',
};

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
    const app = buildApp({ config: loadConfig(baseEnv) });
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });
});
