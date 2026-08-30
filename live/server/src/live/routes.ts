import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { z } from 'zod';
import type { PaymentGateway } from '../billing/gateway.js';
import { getPublicState, placeBid, buyNow } from './engine.js';

const bidSchema = z.object({ itemId: z.string().uuid(), amountOre: z.number().int().positive().max(100_000_000) });
const buySchema = z.object({ itemId: z.string().uuid() });

export function registerLive(
  app: FastifyInstance, pool: pg.Pool, gateway: PaymentGateway, now: () => Date,
  stripePublishableKey: string | null = null,
): void {
  app.get('/live/state', async () => getPublicState(pool));

  app.get('/live/config', async () => ({ stripePublishableKey }));

  app.post('/live/bid', { preHandler: app.requireAuth }, async (request, reply) => {
    const parsed = bidSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    const { customerId, bidReady } = request.customer!;
    const res = await placeBid(pool, parsed.data.itemId, { customerId, bidReady }, parsed.data.amountOre, now);
    if (!res.ok) return reply.code(res.reason === 'not_bid_ready' ? 403 : 409).send({ error: res.reason });
    app.hub.broadcast({ type: 'state', state: await getPublicState(pool) });
    return { ok: true, amountOre: res.amountOre, endsAt: res.endsAt };
  });

  app.post('/live/buy', { preHandler: app.requireAuth }, async (request, reply) => {
    const parsed = buySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    const { customerId, bidReady } = request.customer!;
    const res = await buyNow(pool, gateway, parsed.data.itemId, { customerId, bidReady }, now);
    if (!res.ok) return reply.code(res.reason === 'not_bid_ready' ? 403 : 409).send({ error: res.reason });
    app.hub.broadcast({ type: 'state', state: await getPublicState(pool) });
    return { ok: true, charged: res.charged };
  });
}
