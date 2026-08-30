import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import type { Config } from './config.js';

export type Deps = {
  config: Config;
};

export function buildApp(deps: Deps): FastifyInstance {
  const app = Fastify({ logger: deps.config.env !== 'test' });
  app.register(cookie, { secret: deps.config.cookieSecret });
  app.get('/healthz', async () => ({ ok: true }));
  return app;
}
