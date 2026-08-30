import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import type pg from 'pg';
import { z } from 'zod';
import type { Mailer } from '../mailer.js';
import { requestOtp, verifyOtp } from './otp.js';
import { createSession, getSession, destroySession, SESSION_TTL_MS } from './session.js';

declare module 'fastify' {
  interface FastifyRequest { customer?: { customerId: string; email: string; bidReady: boolean } }
  interface FastifyInstance { requireAuth: preHandlerHookHandler }
}

const COOKIE = 'cf_session';
const emailSchema = z.object({ email: z.string().email().transform(e => e.toLowerCase()) });
const verifySchema = emailSchema.extend({ code: z.string().regex(/^\d{6}$/) });

export function registerAuth(app: FastifyInstance, pool: pg.Pool, mailer: Mailer, now: () => Date): void {
  const cookieOpts = {
    httpOnly: true, sameSite: 'lax' as const, path: '/', secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_TTL_MS / 1000,
  };

  app.decorate('requireAuth', (async (request, reply) => {
    const raw = request.cookies[COOKIE];
    const session = raw ? await getSession(pool, raw, now) : null;
    if (!session) return reply.code(401).send({ error: 'unauthorized' });
    request.customer = session;
  }) as preHandlerHookHandler);

  app.post('/auth/request-code', async (request, reply) => {
    const parsed = emailSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    const res = await requestOtp(pool, parsed.data.email, mailer, now);
    if (!res.ok) return reply.code(429).send({ error: res.reason });
    return { ok: true };
  });

  app.post('/auth/verify', async (request, reply) => {
    const parsed = verifySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    const { email, code } = parsed.data;
    const res = await verifyOtp(pool, email, code, now);
    if (!res.ok) return reply.code(401).send({ error: res.reason });
    const { rows } = await pool.query(
      `INSERT INTO customers (email) VALUES ($1)
       ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email RETURNING id`,
      [email],
    );
    const token = await createSession(pool, rows[0].id, now);
    reply.setCookie(COOKIE, token, cookieOpts);
    return { ok: true };
  });

  app.get('/auth/me', { preHandler: app.requireAuth }, async (request) => {
    return { email: request.customer!.email, bidReady: request.customer!.bidReady };
  });

  app.post('/auth/logout', async (request, reply) => {
    const raw = request.cookies[COOKIE];
    if (raw) await destroySession(pool, raw);
    reply.clearCookie(COOKIE, { path: '/' });
    return { ok: true };
  });
}
