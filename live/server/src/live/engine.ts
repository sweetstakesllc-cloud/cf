import type pg from 'pg';

export const SOFT_CLOSE_MS = 10_000;
export type EngineEvent = { type: string; payload: Record<string, unknown> };
export type PublicState = {
  stream: { id: string; title: string; status: 'live' | 'ended' } | null;
  pinned: null | {
    itemId: string; title: string; imageUrl: string | null; mode: 'auction' | 'buy_now';
    state: string; startingBidOre: number | null; minIncrementOre: number;
    buyNowPriceOre: number | null; currentBidOre: number | null;
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

export async function createStream(pool: pg.Pool, title: string): Promise<{ streamId: string }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT pg_advisory_xact_lock(hashtext('streams'))`);
    const live = await client.query(`SELECT id FROM streams WHERE status='live'`);
    if (live.rows.length > 0) throw new Error('stream_already_live');
    const { rows } = await client.query(`INSERT INTO streams (title) VALUES ($1) RETURNING id`, [title]);
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
    const item = await client.query(`SELECT id, stream_id, title FROM stream_items WHERE id=$1 FOR UPDATE`, [itemId]);
    if (!item.rows[0]) throw new Error('not_found');
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
  const stream = await pool.query(`SELECT id, title, status FROM streams WHERE status='live' LIMIT 1`);
  if (!stream.rows[0]) return { stream: null, pinned: null, queueLength: 0 };
  const s = stream.rows[0];
  const item = await pool.query(
    `SELECT i.*, c.email AS winner_email,
            (SELECT count(*)::int FROM bids b WHERE b.item_id = i.id) AS bid_count
     FROM stream_items i LEFT JOIN customers c ON c.id = i.winner_id
     WHERE i.stream_id=$1 AND i.state <> 'queued'
     ORDER BY CASE WHEN i.state IN ('pinned','auction_open') THEN 0 ELSE 1 END, i.pinned_at DESC NULLS LAST LIMIT 1`, [s.id]);
  const q = await pool.query(`SELECT count(*)::int AS n FROM stream_items WHERE stream_id=$1 AND state='queued'`, [s.id]);
  const r = item.rows[0];
  return {
    stream: { id: s.id, title: s.title, status: s.status },
    pinned: r ? {
      itemId: r.id, title: r.title, imageUrl: r.image_url, mode: r.mode, state: r.state,
      startingBidOre: r.starting_bid_ore, minIncrementOre: r.min_increment_ore,
      buyNowPriceOre: r.buy_now_price_ore, currentBidOre: r.current_bid_ore,
      endsAt: r.ends_at ? new Date(r.ends_at).toISOString() : null, bidCount: r.bid_count,
      winner: r.winner_id && r.winning_amount_ore
        ? { emailMasked: maskEmail(r.winner_email), amountOre: r.winning_amount_ore } : null,
    } : null,
    queueLength: q.rows[0].n,
  };
}
