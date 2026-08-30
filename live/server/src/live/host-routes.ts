import type { FastifyInstance, FastifyReply, preHandlerHookHandler } from 'fastify';
import type pg from 'pg';
import { z } from 'zod';
import type { PaymentGateway } from '../billing/gateway.js';
import {
  createStream, endStream, addItem, pinItem, openAuction, extendAuction,
  passItem, secondChance, getPublicState,
} from './engine.js';
import { chargeWinner } from './charge.js';
import { HOST_HTML } from './host-page.js';

const ERROR_STATUS: Record<string, number> = {
  stream_already_live: 409, auction_in_progress: 409, cannot_open: 409, not_open: 409,
  cannot_pass: 409, cannot_second_chance: 409, no_underbidder: 409, invalid_item: 400, not_found: 404,
  cannot_pin: 409, not_won: 409,
};

function mapEngineError(reply: FastifyReply, err: unknown): FastifyReply {
  const message = err instanceof Error ? err.message : '';
  const status = ERROR_STATUS[message];
  if (!status) throw err;
  return reply.code(status).send({ error: message });
}

export function registerHost(
  app: FastifyInstance, pool: pg.Pool, gateway: PaymentGateway, now: () => Date, hostPassword: string | null,
): void {
  const requireHost: preHandlerHookHandler = async (request, reply) => {
    if (!hostPassword) return reply.code(503).send({ error: 'host_disabled' });
    if (request.headers.authorization !== `Bearer ${hostPassword}`)
      return reply.code(401).send({ error: 'unauthorized' });
  };

  const broadcast = async () => app.hub.broadcast({ type: 'state', state: await getPublicState(pool) });

  app.get('/host', async (_req, reply) => reply.type('text/html').send(HOST_HTML));

  app.register(async (host) => {
    host.addHook('preHandler', requireHost);

    host.post('/host/streams', async (request, reply) => {
      const parsed = z.object({ title: z.string().min(1), playbackUrl: z.string().url().optional() }).safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
      try {
        const { streamId } = await createStream(pool, parsed.data.title, parsed.data.playbackUrl);
        await broadcast();
        return reply.code(201).send({ streamId });
      } catch (err) { return mapEngineError(reply, err); }
    });

    host.post('/host/streams/end', async (request, reply) => {
      const parsed = z.object({ streamId: z.string().uuid() }).safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
      await endStream(pool, parsed.data.streamId, now);
      await broadcast();
      return { ok: true };
    });

    host.post('/host/items', async (request, reply) => {
      const parsed = z.object({
        streamId: z.string().uuid(), title: z.string().min(1), imageUrl: z.string().url().optional(),
        mode: z.enum(['auction', 'buy_now']), startingBidOre: z.number().int().positive().optional(),
        minIncrementOre: z.number().int().positive().optional(), buyNowPriceOre: z.number().int().positive().optional(),
      }).safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
      try {
        const { streamId, ...input } = parsed.data;
        const { itemId } = await addItem(pool, streamId, input);
        await broadcast();
        return reply.code(201).send({ itemId });
      } catch (err) { return mapEngineError(reply, err); }
    });

    const idParam = z.object({ id: z.string().uuid() });

    host.post('/host/items/:id/pin', async (request, reply) => {
      const p = idParam.safeParse(request.params);
      if (!p.success) return reply.code(400).send({ error: 'bad_request' });
      try { await pinItem(pool, p.data.id, now); await broadcast(); return { ok: true }; }
      catch (err) { return mapEngineError(reply, err); }
    });

    host.post('/host/items/:id/open-auction', async (request, reply) => {
      const p = idParam.safeParse(request.params);
      const b = z.object({ durationSec: z.number().int().min(10).max(600) }).safeParse(request.body);
      if (!p.success || !b.success) return reply.code(400).send({ error: 'bad_request' });
      try {
        await openAuction(pool, p.data.id, b.data.durationSec * 1000, now);
        await broadcast();
        return { ok: true, endsAt: new Date(now().getTime() + b.data.durationSec * 1000).toISOString() };
      } catch (err) { return mapEngineError(reply, err); }
    });

    host.post('/host/items/:id/extend', async (request, reply) => {
      const p = idParam.safeParse(request.params);
      const b = z.object({ extraSec: z.number().int().min(1).max(600) }).safeParse(request.body);
      if (!p.success || !b.success) return reply.code(400).send({ error: 'bad_request' });
      try { await extendAuction(pool, p.data.id, b.data.extraSec * 1000, now); await broadcast(); return { ok: true }; }
      catch (err) { return mapEngineError(reply, err); }
    });

    host.post('/host/items/:id/pass', async (request, reply) => {
      const p = idParam.safeParse(request.params);
      if (!p.success) return reply.code(400).send({ error: 'bad_request' });
      try { await passItem(pool, p.data.id, now); await broadcast(); return { ok: true }; }
      catch (err) { return mapEngineError(reply, err); }
    });

    host.post('/host/items/:id/second-chance', async (request, reply) => {
      const p = idParam.safeParse(request.params);
      if (!p.success) return reply.code(400).send({ error: 'bad_request' });
      try {
        const events = await secondChance(pool, gateway, p.data.id, now);
        await broadcast();
        return { ok: true, charged: events.some(e => e.type === 'item_charged') };
      } catch (err) { return mapEngineError(reply, err); }
    });

    host.post('/host/items/:id/retry-charge', async (request, reply) => {
      const p = idParam.safeParse(request.params);
      if (!p.success) return reply.code(400).send({ error: 'bad_request' });
      try {
        const events = await chargeWinner(pool, gateway, p.data.id, now);
        await broadcast();
        return { ok: true, charged: events.some(e => e.type === 'item_charged') };
      } catch (err) { return mapEngineError(reply, err); }
    });

    host.post('/host/mute', async (request, reply) => {
      const parsed = z.object({ fromId: z.string().regex(/^[0-9a-f]{8}$/) }).safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
      app.hub.mute(parsed.data.fromId);
      return { ok: true };
    });

    host.get('/host/state', async () => {
      const state = await getPublicState(pool);
      if (!state.stream) return { ...state, queue: [] };
      const queue = await pool.query(
        `SELECT id, position, title, mode, state, starting_bid_ore, buy_now_price_ore
         FROM stream_items WHERE stream_id=$1 AND state='queued' ORDER BY position`, [state.stream.id]);
      let hostPinned: Record<string, unknown> | null = state.pinned;
      if (state.pinned?.winner) {
        const w = await pool.query(
          `SELECT c.email, ch.status FROM stream_items i
           JOIN customers c ON c.id = i.winner_id
           LEFT JOIN charges ch ON ch.item_id = i.id AND ch.customer_id = i.winner_id
           WHERE i.id=$1 ORDER BY ch.created_at DESC LIMIT 1`, [state.pinned.itemId]);
        hostPinned = { ...state.pinned, winnerEmail: w.rows[0]?.email ?? null, chargeStatus: w.rows[0]?.status ?? null };
      }
      return {
        ...state, pinned: hostPinned,
        queue: queue.rows.map(r => ({
          itemId: r.id, position: r.position, title: r.title, mode: r.mode, state: r.state,
          startingBidOre: r.starting_bid_ore, buyNowPriceOre: r.buy_now_price_ore,
        })),
      };
    });
  });
}
