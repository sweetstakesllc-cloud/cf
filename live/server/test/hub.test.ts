import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getTestPool, truncateAll } from './helpers.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { FakePaymentGateway } from '../src/billing/gateway.js';
import type { Mailer } from '../src/mailer.js';
import type pg from 'pg';
import type { FastifyInstance } from 'fastify';
import WebSocket from 'ws';

let pool: pg.Pool;
let app: FastifyInstance;
let base: string;
const sent: { email: string; code: string }[] = [];
const mailer: Mailer = { async sendOtp(email, code) { sent.push({ email, code }); } };

beforeAll(async () => {
  pool = await getTestPool();
  app = buildApp({
    config: loadConfig({
      NODE_ENV: 'test', DATABASE_URL: 'postgres://cf:cf@localhost:5433/cf_live',
      COOKIE_SECRET: 'test-cookie-secret-at-least-32-chars!!',
    }),
    pool, mailer, gateway: new FakePaymentGateway(),
  });
  // Explicit host: on some environments 'localhost' resolves to ::1 (IPv6)
  // while the ws client below connects to 127.0.0.1 (IPv4), causing ECONNREFUSED.
  await app.listen({ port: 0, host: '127.0.0.1' });
  const addr = app.server.address();
  base = `ws://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
});
afterAll(async () => { await app.close(); await pool.end(); });
beforeEach(async () => { await truncateAll(pool); sent.length = 0; });

function connect(cookie?: string): Promise<{ ws: WebSocket; messages: unknown[]; next: (pred?: (m: any) => boolean) => Promise<any> }> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${base}/live/ws`, cookie ? { headers: { cookie } } : undefined);
    const messages: unknown[] = [];
    const waiters: Array<{ pred: (m: any) => boolean; res: (m: any) => void }> = [];
    ws.on('message', (data) => {
      const m = JSON.parse(String(data));
      messages.push(m);
      const idx = waiters.findIndex(w => w.pred(m));
      if (idx >= 0) waiters.splice(idx, 1)[0]!.res(m);
    });
    ws.on('open', () => resolve({
      ws, messages,
      next: (pred = () => true) => new Promise((res) => {
        const found = messages.find(pred);
        if (found) return res(found);
        waiters.push({ pred, res });
      }),
    }));
    ws.on('error', reject);
  });
}

async function loggedInCookie(email = 'anna@x.se'): Promise<string> {
  await app.inject({ method: 'POST', url: '/auth/request-code', payload: { email } });
  const res = await app.inject({ method: 'POST', url: '/auth/verify', payload: { email, code: sent.at(-1)!.code } });
  return `cf_session=${res.cookies.find(c => c.name === 'cf_session')!.value}`;
}

describe('/live/ws', () => {
  it('sends state on connect and tracks viewer count', async () => {
    const a = await connect();
    const st = await a.next(m => m.type === 'state');
    expect(st.state).toHaveProperty('stream');
    const b = await connect();
    const v = await b.next(m => m.type === 'viewers');
    expect(v.count).toBeGreaterThanOrEqual(2);
    a.ws.close(); b.ws.close();
  });

  it('relays chat from authenticated users and refuses anonymous chat', async () => {
    const anon = await connect();
    anon.ws.send(JSON.stringify({ type: 'chat', text: 'hej' }));
    const err = await anon.next(m => m.type === 'error');
    expect(err.error).toBe('auth_required');

    const authed = await connect(await loggedInCookie());
    authed.ws.send(JSON.stringify({ type: 'chat', text: 'hej!' }));
    const chat = await anon.next(m => m.type === 'chat');
    expect(chat).toMatchObject({ from: 'a***', text: 'hej!' });
    anon.ws.close(); authed.ws.close();
  });

  it('rate-limits chat per customer', async () => {
    const authed = await connect(await loggedInCookie());
    authed.ws.send(JSON.stringify({ type: 'chat', text: 'one' }));
    authed.ws.send(JSON.stringify({ type: 'chat', text: 'two' }));
    const err = await authed.next(m => m.type === 'error' && m.error === 'slow_down');
    expect(err.error).toBe('slow_down');
    authed.ws.close();
  });
});

describe('chat identity and mute', () => {
  it('stamps chat with a stable non-uuid fromId', async () => {
    const watcher = await connect();
    const authed = await connect(await loggedInCookie());
    authed.ws.send(JSON.stringify({ type: 'chat', text: 'hej!' }));
    const chat = await watcher.next(m => m.type === 'chat');
    expect(chat.fromId).toMatch(/^[0-9a-f]{8}$/);
    const { rows } = await pool.query(`SELECT id FROM customers WHERE email='anna@x.se'`);
    expect(chat.fromId).not.toContain(rows[0].id.slice(0, 8));
    watcher.ws.close(); authed.ws.close();
  });

  it('drops chat from a muted sender with an error, leaving others alone', async () => {
    const watcher = await connect();
    const anna = await connect(await loggedInCookie('anna@x.se'));
    const bert = await connect(await loggedInCookie('bert@x.se'));
    anna.ws.send(JSON.stringify({ type: 'chat', text: 'first' }));
    const first = await watcher.next(m => m.type === 'chat');
    app.hub.mute(first.fromId);
    await new Promise(r => setTimeout(r, 2100)); // clear the chat cooldown
    anna.ws.send(JSON.stringify({ type: 'chat', text: 'again' }));
    const err = await anna.next(m => m.type === 'error' && m.error === 'muted');
    expect(err.error).toBe('muted');
    bert.ws.send(JSON.stringify({ type: 'chat', text: 'unaffected' }));
    const chat = await watcher.next(m => m.type === 'chat' && m.text === 'unaffected');
    expect(chat.from).toBe('b***');
    expect(watcher.messages.filter(m => (m as any).type === 'chat').map(m => (m as any).text)).not.toContain('again');
    watcher.ws.close(); anna.ws.close(); bert.ws.close();
  });
});
