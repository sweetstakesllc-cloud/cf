import { fileURLToPath } from 'node:url';
import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import websocket from '@fastify/websocket';
import type pg from 'pg';
import type { Config } from './config.js';
import type { Mailer } from './mailer.js';
import { registerAuth } from './auth/routes.js';
import type { PaymentGateway } from './billing/gateway.js';
import { registerBilling } from './billing/routes.js';
import { registerLive } from './live/routes.js';
import { registerHost } from './live/host-routes.js';
import { Hub } from './live/hub.js';
import { getSession } from './auth/session.js';
import { getPublicState } from './live/engine.js';
import { VIEWER_HTML } from './live/viewer-page.js';
import { registerCertificateRoutes } from './certificates/routes.js';

declare module 'fastify' {
  interface FastifyInstance { hub: Hub }
}

export type Deps = {
  config: Config;
  pool: pg.Pool;
  mailer: Mailer;
  gateway: PaymentGateway;
  now?: () => Date;
};

export function buildApp(deps: Deps): FastifyInstance {
  const now = deps.now ?? (() => new Date());
  const app = Fastify({ logger: deps.config.env !== 'test' });
  app.register(cookie, { secret: deps.config.cookieSecret });
  if (deps.config.widgetOrigins.length > 0)
    app.register(cors, { origin: deps.config.widgetOrigins, credentials: true });
  app.get('/healthz', async () => ({ ok: true }));
  app.register(fastifyStatic, {
    root: fileURLToPath(new URL('../public', import.meta.url)),
    prefix: '/static/',
    maxAge: '10m', // long enough for a stream, short enough to ship widget fixes
  });
  app.get('/live', async (_req, reply) => reply.type('text/html').send(VIEWER_HTML));
  registerAuth(app, deps.pool, deps.mailer, now, deps.config.env);
  registerBilling(app, deps.pool, deps.gateway);
  registerLive(app, deps.pool, deps.gateway, now, deps.config.stripePublishableKey);
  registerHost(app, deps.pool, deps.gateway, now, deps.config.hostPassword);
  registerCertificateRoutes(
    app,
    deps.pool,
    deps.config.shopifyWebhookSecret,
    deps.config.certificateStorageDirectory,
  );

  const hub = new Hub(now);
  app.decorate('hub', hub);
  app.register(websocket);
  app.register(async (scope) => {
    scope.get('/live/ws', {
      websocket: true,
      // Resolve the session here (in a preHandler, which fastify awaits before
      // the route handler runs) rather than in the ws handler itself.
      // @fastify/websocket completes the WS upgrade — firing the client's
      // 'open' event — before invoking the route handler. An await inside the
      // handler before wiring up the 'message' listener (via hub.add) leaves a
      // window where a message sent immediately by the client arrives before
      // any listener is attached and is silently dropped. Resolving the
      // session up front lets the handler call hub.add() synchronously.
      preHandler: async (req) => {
        const raw = req.cookies['cf_session'];
        req.customer = raw ? (await getSession(deps.pool, raw, now)) ?? undefined : undefined;
      },
    }, (socket, req) => {
      const session = req.customer;
      hub.add(socket, session ? { customerId: session.customerId, email: session.email } : null);
      getPublicState(deps.pool).then(
        (state) => socket.send(JSON.stringify({ type: 'state', state })),
        (err) => req.log.error(err),
      );
    });
  });

  return app;
}
