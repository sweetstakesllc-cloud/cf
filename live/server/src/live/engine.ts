import type pg from 'pg';
import { chargeWinner } from './charge.js';
import type { PaymentGateway } from '../billing/gateway.js';

export const SOFT_CLOSE_MS = 10_000;
export type EngineEvent = { type: string; payload: Record<string, unknown> };
export type PublicState = {
  stream: { id: string; title: string; status: 'live' | 'ended'; playbackUrl: string | null } | null;
  pinned: null | {
    itemId: string; title: string; imageUrl: string | null; mode: 'auction' | 'buy_now';
    state: string; startingBidOre: number | null; minIncrementOre: number;
    buyNowPriceOre: number | null; currentBidOre: number | null;
    currentBidderMasked: string | null;
    endsAt: string | null; bidCount: number;
    winner: null | { emailMasked: string; amountOre: number };
  };
  queueLength: number;
};

export function maskEmail(email: string): string {
  return `${email[0] ?? '?'}***`;
}

async function logEvent(q: pg.PoolClient | pg.Pool, streamId: string | null, type: string, payload: Record<string, unknown>): Promise<EngineEvent> {
  await q.query(`INSERT INTO events (stream_id, type, payload) VALUES ($1, $2, $3)`, [streamId, type, payload]);
  return { type, payload };
}

export async function createStream(pool: pg.Pool, title: string, playbackUrl?: string): Promise<{ streamId: string }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT pg_advisory_xact_lock(hashtext('streams'))`);
    const live = await client.query(`SELECT id FROM streams WHERE status='live'`);
    if (live.rows.length > 0) throw new Error('stream_already_live');
    const { rows } = await client.query(
      `INSERT INTO streams (title, playback_url) VALUES ($1, $2) RETURNING id`, [title, playbackUrl ?? null]);
    await logEvent(client, rows[0].id, 'stream_created', { title });
    await client.query('COMMIT');
    return { streamId: rows[0].id };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function endStream(pool: pg.Pool, streamId: string, now: () => Date): Promise<void> {
  await pool.query(`UPDATE streams SET status='ended', ended_at=$2 WHERE id=$1`, [streamId, now()]);
  await logEvent(pool, streamId, 'stream_ended', {});
}

export async function getActiveStreamId(pool: pg.Pool): Promise<string | null> {
  const { rows } = await pool.query(`SELECT id FROM streams WHERE status='live' LIMIT 1`);
  return rows[0]?.id ?? null;
}

export async function addItem(pool: pg.Pool, streamId: string, input: {
  title: string; imageUrl?: string; mode: 'auction' | 'buy_now';
  startingBidOre?: number; minIncrementOre?: number; buyNowPriceOre?: number;
}): Promise<{ itemId: string }> {
  if (input.mode === 'auction' && !input.startingBidOre) throw new Error('invalid_item');
  if (input.mode === 'buy_now' && !input.buyNowPriceOre) throw new Error('invalid_item');
  const { rows } = await pool.query(
    `INSERT INTO stream_items (stream_id, position, title, image_url, mode, starting_bid_ore, min_increment_ore, buy_now_price_ore)
     VALUES ($1, (SELECT coalesce(max(position),0)+1 FROM stream_items WHERE stream_id=$1),
             $2, $3, $4, $5, coalesce($6, 10000), $7)
     RETURNING id`,
    [streamId, input.title, input.imageUrl ?? null, input.mode,
     input.startingBidOre ?? null, input.minIncrementOre ?? null, input.buyNowPriceOre ?? null]);
  await logEvent(pool, streamId, 'item_added', { itemId: rows[0].id, title: input.title });
  return { itemId: rows[0].id };
}

export async function pinItem(pool: pg.Pool, itemId: string, now: () => Date): Promise<EngineEvent[]> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const open = await client.query(`SELECT id FROM stream_items WHERE state='auction_open' FOR UPDATE`);
    if (open.rows.length > 0) throw new Error('auction_in_progress');
    const item = await client.query(`SELECT id, stream_id, title, state FROM stream_items WHERE id=$1 FOR UPDATE`, [itemId]);
    if (!item.rows[0]) throw new Error('not_found');
    if (!['queued', 'pinned'].includes(item.rows[0].state)) throw new Error('cannot_pin');
    await client.query(`UPDATE stream_items SET state='queued' WHERE state='pinned' AND id <> $1`, [itemId]);
    await client.query(`UPDATE stream_items SET state='pinned', pinned_at=$2 WHERE id=$1`, [itemId, now()]);
    const ev = await logEvent(client, item.rows[0].stream_id, 'item_pinned', { itemId, title: item.rows[0].title });
    await client.query('COMMIT');
    return [ev];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getPublicState(pool: pg.Pool): Promise<PublicState> {
  const stream = await pool.query(`SELECT id, title, status, playback_url FROM streams WHERE status='live' LIMIT 1`);
  if (!stream.rows[0]) return { stream: null, pinned: null, queueLength: 0 };
  const s = stream.rows[0];
  const item = await pool.query(
    `SELECT i.*, c.email AS winner_email, cb.email AS current_bidder_email,
            (SELECT count(*)::int FROM bids b WHERE b.item_id = i.id) AS bid_count
     FROM stream_items i LEFT JOIN customers c ON c.id = i.winner_id
     LEFT JOIN customers cb ON cb.id = i.current_bidder_id
     WHERE i.stream_id=$1 AND i.state <> 'queued'
     ORDER BY CASE WHEN i.state IN ('pinned','auction_open') THEN 0 ELSE 1 END, i.pinned_at DESC NULLS LAST LIMIT 1`, [s.id]);
  const q = await pool.query(`SELECT count(*)::int AS n FROM stream_items WHERE stream_id=$1 AND state='queued'`, [s.id]);
  const r = item.rows[0];
  return {
    stream: { id: s.id, title: s.title, status: s.status, playbackUrl: s.playback_url },
    pinned: r ? {
      itemId: r.id, title: r.title, imageUrl: r.image_url, mode: r.mode, state: r.state,
      startingBidOre: r.starting_bid_ore, minIncrementOre: r.min_increment_ore,
      buyNowPriceOre: r.buy_now_price_ore, currentBidOre: r.current_bid_ore,
      currentBidderMasked: r.current_bidder_email ? maskEmail(r.current_bidder_email) : null,
      endsAt: r.ends_at ? new Date(r.ends_at).toISOString() : null, bidCount: r.bid_count,
      winner: r.winner_id && r.winning_amount_ore
        ? { emailMasked: maskEmail(r.winner_email), amountOre: r.winning_amount_ore } : null,
    } : null,
    queueLength: q.rows[0].n,
  };
}

export type BidRejection = 'not_bid_ready' | 'not_open' | 'too_low' | 'ended';

export async function openAuction(pool: pg.Pool, itemId: string, durationMs: number, now: () => Date): Promise<EngineEvent[]> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const open = await client.query(`SELECT id FROM stream_items WHERE state='auction_open' FOR UPDATE`);
    if (open.rows.length > 0) throw new Error('auction_in_progress');
    const { rows } = await client.query(`SELECT * FROM stream_items WHERE id=$1 FOR UPDATE`, [itemId]);
    const item = rows[0];
    if (!item || item.state !== 'pinned' || item.mode !== 'auction') throw new Error('cannot_open');
    const endsAt = new Date(now().getTime() + durationMs);
    await client.query(
      `UPDATE stream_items SET state='auction_open', current_bid_ore=NULL, current_bidder_id=NULL, ends_at=$2 WHERE id=$1`,
      [itemId, endsAt]);
    const ev = await logEvent(client, item.stream_id, 'auction_opened',
      { itemId, startingBidOre: item.starting_bid_ore, endsAt: endsAt.toISOString() });
    await client.query('COMMIT');
    return [ev];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function placeBid(
  pool: pg.Pool, itemId: string, bidder: { customerId: string; bidReady: boolean }, amountOre: number, now: () => Date,
): Promise<{ ok: true; amountOre: number; endsAt: string; events: EngineEvent[] } | { ok: false; reason: BidRejection }> {
  if (!bidder.bidReady) return { ok: false, reason: 'not_bid_ready' };
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`SELECT * FROM stream_items WHERE id=$1 FOR UPDATE`, [itemId]);
    const item = rows[0];
    if (!item || item.state !== 'auction_open') { await client.query('ROLLBACK'); return { ok: false, reason: 'not_open' }; }
    const t = now();
    if (new Date(item.ends_at) <= t) { await client.query('ROLLBACK'); return { ok: false, reason: 'ended' }; }
    const minAcceptable = item.current_bid_ore != null
      ? item.current_bid_ore + item.min_increment_ore
      : item.starting_bid_ore;
    if (amountOre < minAcceptable) { await client.query('ROLLBACK'); return { ok: false, reason: 'too_low' }; }
    await client.query(`INSERT INTO bids (item_id, customer_id, amount_ore, created_at) VALUES ($1, $2, $3, $4)`,
      [itemId, bidder.customerId, amountOre, t]);
    let endsAt = new Date(item.ends_at);
    if (endsAt.getTime() - t.getTime() < SOFT_CLOSE_MS) endsAt = new Date(t.getTime() + SOFT_CLOSE_MS);
    await client.query(
      `UPDATE stream_items SET current_bid_ore=$2, current_bidder_id=$3, ends_at=$4 WHERE id=$1`,
      [itemId, amountOre, bidder.customerId, endsAt]);
    const email = await client.query(`SELECT email FROM customers WHERE id=$1`, [bidder.customerId]);
    const ev = await logEvent(client, item.stream_id, 'bid_placed',
      { itemId, amountOre, bidderMasked: maskEmail(email.rows[0].email), endsAt: endsAt.toISOString() });
    await client.query('COMMIT');
    return { ok: true, amountOre, endsAt: endsAt.toISOString(), events: [ev] };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function extendAuction(pool: pg.Pool, itemId: string, extraMs: number, now: () => Date): Promise<EngineEvent[]> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`SELECT * FROM stream_items WHERE id=$1 FOR UPDATE`, [itemId]);
    const item = rows[0];
    if (!item || item.state !== 'auction_open') throw new Error('not_open');
    const base = Math.max(new Date(item.ends_at).getTime(), now().getTime());
    const endsAt = new Date(base + extraMs);
    await client.query(`UPDATE stream_items SET ends_at=$2 WHERE id=$1`, [itemId, endsAt]);
    const ev = await logEvent(client, item.stream_id, 'auction_extended', { itemId, endsAt: endsAt.toISOString() });
    await client.query('COMMIT');
    return [ev];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function passItem(pool: pg.Pool, itemId: string, now: () => Date): Promise<EngineEvent[]> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`SELECT * FROM stream_items WHERE id=$1 FOR UPDATE`, [itemId]);
    const item = rows[0];
    if (!item || !['pinned', 'auction_open', 'payment_failed'].includes(item.state)) throw new Error('cannot_pass');
    await client.query(`UPDATE stream_items SET state='passed' WHERE id=$1`, [itemId]);
    const ev = await logEvent(client, item.stream_id, 'item_passed', { itemId });
    await client.query('COMMIT');
    return [ev];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function settleDueAuctions(pool: pg.Pool, gateway: PaymentGateway, now: () => Date): Promise<EngineEvent[]> {
  const events: EngineEvent[] = [];
  const toCharge: string[] = [];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const due = await client.query(
      `SELECT * FROM stream_items WHERE state='auction_open' AND ends_at <= $1 FOR UPDATE SKIP LOCKED`, [now()]);
    for (const item of due.rows) {
      if (item.current_bidder_id != null) {
        await client.query(
          `UPDATE stream_items SET state='won', winner_id=$2, winning_amount_ore=$3 WHERE id=$1`,
          [item.id, item.current_bidder_id, item.current_bid_ore]);
        events.push(await logEvent(client, item.stream_id, 'auction_won',
          { itemId: item.id, amountOre: item.current_bid_ore }));
        toCharge.push(item.id);
      } else {
        await client.query(`UPDATE stream_items SET state='passed' WHERE id=$1`, [item.id]);
        events.push(await logEvent(client, item.stream_id, 'item_passed', { itemId: item.id }));
      }
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  for (const itemId of toCharge) events.push(...await chargeWinner(pool, gateway, itemId, now));
  return events;
}

export async function secondChance(pool: pg.Pool, gateway: PaymentGateway, itemId: string, now: () => Date): Promise<EngineEvent[]> {
  const events: EngineEvent[] = [];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`SELECT * FROM stream_items WHERE id=$1 FOR UPDATE`, [itemId]);
    const item = rows[0];
    if (!item || item.state !== 'payment_failed') throw new Error('cannot_second_chance');
    const under = await client.query(
      `SELECT customer_id, amount_ore FROM bids
       WHERE item_id=$1 AND customer_id <> $2
       AND customer_id NOT IN (SELECT customer_id FROM charges WHERE item_id=$1 AND status='failed')
       ORDER BY amount_ore DESC, created_at ASC LIMIT 1`,
      [itemId, item.winner_id]);
    if (!under.rows[0]) throw new Error('no_underbidder');
    await client.query(
      `UPDATE stream_items SET state='won', winner_id=$2, winning_amount_ore=$3 WHERE id=$1`,
      [itemId, under.rows[0].customer_id, under.rows[0].amount_ore]);
    events.push(await logEvent(client, item.stream_id, 'second_chance',
      { itemId, amountOre: under.rows[0].amount_ore }));
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  events.push(...await chargeWinner(pool, gateway, itemId, now));
  return events;
}

export type BuyRejection = 'not_bid_ready' | 'not_available';

export async function buyNow(
  pool: pg.Pool, gateway: PaymentGateway, itemId: string,
  buyer: { customerId: string; bidReady: boolean }, now: () => Date,
): Promise<{ ok: true; charged: boolean; events: EngineEvent[] } | { ok: false; reason: BuyRejection }> {
  if (!buyer.bidReady) return { ok: false, reason: 'not_bid_ready' };
  const events: EngineEvent[] = [];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`SELECT * FROM stream_items WHERE id=$1 FOR UPDATE`, [itemId]);
    const item = rows[0];
    if (!item || item.state !== 'pinned' || item.mode !== 'buy_now') {
      await client.query('ROLLBACK');
      return { ok: false, reason: 'not_available' };
    }
    await client.query(
      `UPDATE stream_items SET state='won', winner_id=$2, winning_amount_ore=buy_now_price_ore WHERE id=$1`,
      [itemId, buyer.customerId]);
    events.push(await logEvent(client, item.stream_id, 'item_claimed',
      { itemId, amountOre: item.buy_now_price_ore }));
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  const chargeEvents = await chargeWinner(pool, gateway, itemId, now);
  events.push(...chargeEvents);
  return { ok: true, charged: chargeEvents.some(e => e.type === 'item_charged'), events };
}
