import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import type pg from 'pg';
import type { Config } from './config.js';
import type { Mailer } from './mailer.js';
import { registerAuth } from './auth/routes.js';

export type Deps = {
  config: Config;
  pool: pg.Pool;
  mailer: Mailer;
  now?: () => Date;
};

export function buildApp(deps: Deps): FastifyInstance {
  const now = deps.now ?? (() => new Date());
  const app = Fastify({ logger: deps.config.env !== 'test' });
  app.register(cookie, { secret: deps.config.cookieSecret });
  app.get('/healthz', async () => ({ ok: true }));
  registerAuth(app, deps.pool, deps.mailer, now, deps.config.env);
  return app;
}
