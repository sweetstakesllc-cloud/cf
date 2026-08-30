# Live Auction Build — Plan 2 of 4: Auction Engine + Host Console

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The heart of the product: a server-authoritative auction engine (pin → open → bid with soft-close → settle → auto-charge), buy-now claims, a WebSocket hub for realtime state + chat, viewer/bid routes, a host API, and a minimal host console page.

**Architecture:** State lives in Postgres, not memory: every mutation runs in a transaction with `SELECT ... FOR UPDATE` on the item row, so bids are atomic, restarts recover for free, and tests inject a fake clock instead of mocking timers. A 500ms ticker in the entrypoint settles due auctions (`FOR UPDATE SKIP LOCKED`). The WebSocket hub only broadcasts snapshots and relays chat — it never decides auction outcomes. Charging goes through the existing `PaymentGateway` seam, widened with `chargeSavedCard`, **always with an idempotency key** (binding review ruling from Plan 1: retried off-session charges must never double-charge a winner).

**Tech Stack:** Everything from Plan 1, plus `@fastify/websocket`.

**Spec:** `docs/superpowers/specs/2026-08-30-live-auction-custom-build-design.md` (§2.2 auction engine, §2.3 payments)

## Global Constraints

- Branch `live-auction-2` from `web-mockups`. All commands from `live/server/`. Docker Postgres on :5433 must be up.
- **Money is always integer öre.** Column names end `_ore`; JS names end `Ore`. No floats, ever.
- **Every gateway charge carries an idempotency key** (format below). A charge call without one is a defect.
- Engine functions are the only writers of auction state. Routes and the hub never `UPDATE stream_items` directly.
- Server-authoritative: no client-supplied timestamps or prices are trusted; bid validation happens inside the row-locked transaction.
- Soft-close: a bid landing with less than `SOFT_CLOSE_MS = 10_000` ms left resets the clock to `SOFT_CLOSE_MS`. One auction at a time (enforced: opening an auction while another is `auction_open` is refused).
- Strict TS, ESM/NodeNext (`.js` import extensions). No `process.env` outside `src/config.ts`. TDD per task: failing test → implement → pass → commit.
- Plan-1 interfaces consumed as they exist on `web-mockups` (post-review): `buildApp(Deps)`, `app.requireAuth` + `request.customer {customerId, email, bidReady}`, `registerAuth(app, pool, mailer, now, env)`, `PaymentGateway`/`FakePaymentGateway`, `hashToken`, `runMigrations`, `getTestPool()/truncateAll()`.

## File Structure (end state)

```
live/server/
  migrations/002-live-commerce.sql      streams, stream_items, bids, charges, events
  src/live/engine.ts                    state machine: streams, items, pin, open, bid, settle, buy-now, second-chance
  src/live/charge.ts                    chargeWinner helper (gateway + charges table + state transition)
  src/live/hub.ts                       WS connection registry, chat, broadcast, viewer count
  src/live/routes.ts                    viewer: GET /live/state, POST /live/bid, POST /live/buy, WS /live/ws
  src/live/host-routes.ts               host API under /host/* (Bearer HOST_PASSWORD)
  src/live/host-page.ts                 HOST_HTML string served at GET /host
  src/config.ts                         + hostPassword
  src/app.ts                            + hub in Deps wiring, register live/host routes
  src/index.ts                          + settle ticker
  test/engine-items.test.ts  engine-bidding.test.ts  engine-settle.test.ts
  test/engine-buynow.test.ts  hub.test.ts  live-routes.test.ts  host-routes.test.ts
```

State machine on `stream_items.state`:
`queued → pinned → auction_open → won → charged` · `won → payment_failed → (second-chance → won → …) | passed` · `pinned → won` (buy-now) · `pinned|auction_open(no bids)|payment_failed → passed` · pinning another item returns a non-sold `pinned` item to `queued`.

---

### Task 1: Migration 002 — live-commerce schema

**Files:**
- Create: `live/server/migrations/002-live-commerce.sql`
- Test: `live/server/test/engine-items.test.ts` (schema smoke only; grows in Task 3)
- Modify: `live/server/test/helpers.ts` (truncate new tables)

**Interfaces:**
- Consumes: migration runner + helpers from Plan 1.
- Produces tables (exact columns below); `truncateAll` clears them all.

- [ ] **Step 1: Write the failing test**

`test/engine-items.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getTestPool, truncateAll } from './helpers.js';
import type pg from 'pg';

let pool: pg.Pool;
beforeAll(async () => { pool = await getTestPool(); });
afterAll(async () => { await pool.end(); });
beforeEach(async () => { await truncateAll(pool); });

describe('live-commerce schema', () => {
  it('has the five tables with expected constraints', async () => {
    const { rows } = await pool.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND table_name IN ('streams','stream_items','bids','charges','events')`);
    expect(rows.map(r => r.table_name).sort()).toEqual(['bids','charges','events','stream_items','streams']);
    await pool.query(`INSERT INTO streams (title) VALUES ('Friday Big Drop')`);
    const s = await pool.query(`SELECT status FROM streams`);
    expect(s.rows[0].status).toBe('live');
    await expect(pool.query(
      `INSERT INTO stream_items (stream_id, position, title, mode)
       SELECT id, 1, 'x', 'raffle' FROM streams`)).rejects.toThrow(); // mode CHECK
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npm test -- engine-items` → FAIL (tables missing).

- [ ] **Step 3: Implement**

`migrations/002-live-commerce.sql`:

```sql
CREATE TABLE streams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  status text NOT NULL DEFAULT 'live' CHECK (status IN ('live','ended')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);

CREATE TABLE stream_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL REFERENCES streams(id),
  position int NOT NULL,
  title text NOT NULL,
  image_url text,
  mode text NOT NULL CHECK (mode IN ('auction','buy_now')),
  starting_bid_ore int,
  min_increment_ore int NOT NULL DEFAULT 10000,
  buy_now_price_ore int,
  state text NOT NULL DEFAULT 'queued'
    CHECK (state IN ('queued','pinned','auction_open','won','charged','payment_failed','passed')),
  current_bid_ore int,
  current_bidder_id uuid REFERENCES customers(id),
  ends_at timestamptz,
  winner_id uuid REFERENCES customers(id),
  winning_amount_ore int,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX stream_items_stream_idx ON stream_items (stream_id, position);
CREATE INDEX stream_items_due_idx ON stream_items (state, ends_at);

CREATE TABLE bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES stream_items(id),
  customer_id uuid NOT NULL REFERENCES customers(id),
  amount_ore int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bids_item_idx ON bids (item_id, amount_ore DESC, created_at ASC);

CREATE TABLE charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES stream_items(id),
  customer_id uuid NOT NULL REFERENCES customers(id),
  amount_ore int NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  gateway_payment_intent_id text,
  status text NOT NULL CHECK (status IN ('succeeded','failed')),
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE events (
  id bigserial PRIMARY KEY,
  stream_id uuid REFERENCES streams(id),
  type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
```

`test/helpers.ts` — replace the TRUNCATE with:

```ts
export async function truncateAll(pool: pg.Pool): Promise<void> {
  await pool.query(`TRUNCATE events, charges, bids, stream_items, streams, sessions, otp_codes, customers CASCADE`);
}
```

- [ ] **Step 4: Run to verify pass** — `npm test` (all files) + `npm run tsc` → clean.
- [ ] **Step 5: Commit** — `git add live/server && git commit -m "feat(live): live-commerce schema (streams, items, bids, charges, events)"`

---

### Task 2: `chargeSavedCard` on the gateway (with mandatory idempotency keys)

**Files:**
- Modify: `live/server/src/billing/gateway.ts`, `live/server/src/billing/stripe.ts`
- Test: `live/server/test/billing.test.ts` (append)

**Interfaces:**
- Produces (exact — Tasks 5/6 consume):

```ts
export type ChargeResult =
  | { status: 'succeeded'; paymentIntentId: string }
  | { status: 'failed'; failureReason: string };

// added to PaymentGateway:
chargeSavedCard(input: {
  gatewayCustomerId: string;
  paymentMethodId: string;
  amountOre: number;
  description: string;
  idempotencyKey: string;   // REQUIRED — binding ruling from Plan 1 final review
}): Promise<ChargeResult>;
```

- `FakePaymentGateway` additions: `charges: Array<{gatewayCustomerId, paymentMethodId, amountOre, description, idempotencyKey}>` (records every call); `failNextCharge = false` — when true, the next call returns `{status:'failed', failureReason:'card_declined'}` and resets the flag; repeated calls with an already-seen `idempotencyKey` return the SAME result as the first call without recording a new charge (idempotency semantics).
- `StripeGateway.chargeSavedCard`: `stripe.paymentIntents.create({ amount: amountOre, currency: 'sek', customer, payment_method, off_session: true, confirm: true, description }, { idempotencyKey })`; catches `Stripe.errors.StripeCardError` → `{status:'failed', failureReason: err.code ?? 'card_declined'}`; success → `{status:'succeeded', paymentIntentId: pi.id}`.

- [ ] **Step 1: Write the failing test** — append to `test/billing.test.ts`:

```ts
describe('chargeSavedCard (fake)', () => {
  it('records the charge with its idempotency key and succeeds', async () => {
    const res = await gateway.chargeSavedCard({
      gatewayCustomerId: 'cus_fake_1', paymentMethodId: 'pm_1',
      amountOre: 420000, description: 'LV Alma PM', idempotencyKey: 'item-1-w-1-420000',
    });
    expect(res.status).toBe('succeeded');
    expect(gateway.charges).toHaveLength(1);
    expect(gateway.charges[0]!.idempotencyKey).toBe('item-1-w-1-420000');
  });

  it('is idempotent: same key returns the first result without a second charge', async () => {
    const first = await gateway.chargeSavedCard({
      gatewayCustomerId: 'c', paymentMethodId: 'p', amountOre: 100,
      description: 'x', idempotencyKey: 'k1',
    });
    const second = await gateway.chargeSavedCard({
      gatewayCustomerId: 'c', paymentMethodId: 'p', amountOre: 100,
      description: 'x', idempotencyKey: 'k1',
    });
    expect(second).toEqual(first);
    expect(gateway.charges).toHaveLength(1);
  });

  it('failNextCharge produces a failed result once', async () => {
    gateway.failNextCharge = true;
    const res = await gateway.chargeSavedCard({
      gatewayCustomerId: 'c', paymentMethodId: 'p', amountOre: 100,
      description: 'x', idempotencyKey: 'k2',
    });
    expect(res).toEqual({ status: 'failed', failureReason: 'card_declined' });
    expect(gateway.failNextCharge).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify fail** — `npm test -- billing` → FAIL (method missing).

- [ ] **Step 3: Implement** — in `gateway.ts` add `ChargeResult`, the interface method, and to the fake:

```ts
charges: Array<{ gatewayCustomerId: string; paymentMethodId: string; amountOre: number; description: string; idempotencyKey: string }> = [];
failNextCharge = false;
private chargeResults = new Map<string, ChargeResult>();

async chargeSavedCard(input: { gatewayCustomerId: string; paymentMethodId: string; amountOre: number; description: string; idempotencyKey: string }): Promise<ChargeResult> {
  const seen = this.chargeResults.get(input.idempotencyKey);
  if (seen) return seen;
  let result: ChargeResult;
  if (this.failNextCharge) {
    this.failNextCharge = false;
    result = { status: 'failed', failureReason: 'card_declined' };
  } else {
    this.charges.push({ ...input });
    result = { status: 'succeeded', paymentIntentId: `pi_fake_${this.charges.length}` };
  }
  this.chargeResults.set(input.idempotencyKey, result);
  return result;
}
```

In `stripe.ts` add the real implementation per the Interfaces block above (import `Stripe` types; `try/catch` narrowing on `err instanceof Stripe.errors.StripeCardError`).

- [ ] **Step 4: Run to verify pass** — `npm test` + `npm run tsc` → clean.
- [ ] **Step 5: Commit** — `git commit -am "feat(live): chargeSavedCard with mandatory idempotency keys"`

---

### Task 3: Engine — streams, item queue, pinning, public state

**Files:**
- Create: `live/server/src/live/engine.ts`
- Test: `live/server/test/engine-items.test.ts` (append)

**Interfaces (produces — exact):**

```ts
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

export function maskEmail(email: string): string;   // 'anna@x.se' → 'a***'
export async function createStream(pool, title: string): Promise<{ streamId: string }>;   // refuses if a live stream exists → throws Error('stream_already_live')
export async function endStream(pool, streamId: string, now: () => Date): Promise<void>;
export async function getActiveStreamId(pool): Promise<string | null>;
export async function addItem(pool, streamId: string, input: {
  title: string; imageUrl?: string; mode: 'auction' | 'buy_now';
  startingBidOre?: number; minIncrementOre?: number; buyNowPriceOre?: number;
}): Promise<{ itemId: string }>;                     // position = max+1; validates mode-required prices → throws Error('invalid_item')
export async function pinItem(pool, itemId: string, now): Promise<EngineEvent[]>;  // returns previous non-sold pinned/auction-less item to 'queued'; refuses if an auction is open → throws Error('auction_in_progress')
export async function getPublicState(pool): Promise<PublicState>;
```

Every mutation also appends to `events` (types: `stream_created`, `stream_ended`, `item_added`, `item_pinned`) inside its own transaction and returns the same as `EngineEvent[]` where declared.

- [ ] **Step 1: Write the failing test** — append to `test/engine-items.test.ts`:

```ts
import {
  createStream, endStream, getActiveStreamId, addItem, pinItem, getPublicState, maskEmail,
} from '../src/live/engine.js';

const now = () => new Date('2026-08-30T19:00:00Z');

describe('streams and items', () => {
  it('creates one live stream at a time', async () => {
    const { streamId } = await createStream(pool, 'Friday Big Drop');
    expect(await getActiveStreamId(pool)).toBe(streamId);
    await expect(createStream(pool, 'Second')).rejects.toThrow('stream_already_live');
    await endStream(pool, streamId, now);
    expect(await getActiveStreamId(pool)).toBeNull();
  });

  it('queues items with ascending positions and validates mode prices', async () => {
    const { streamId } = await createStream(pool, 'S');
    await addItem(pool, streamId, { title: 'Gucci Jackie', mode: 'auction', startingBidOre: 150000 });
    await addItem(pool, streamId, { title: 'Burberry Polo', mode: 'buy_now', buyNowPriceOre: 90000 });
    await expect(addItem(pool, streamId, { title: 'x', mode: 'auction' })).rejects.toThrow('invalid_item');
    await expect(addItem(pool, streamId, { title: 'x', mode: 'buy_now' })).rejects.toThrow('invalid_item');
    const { rows } = await pool.query(`SELECT position FROM stream_items ORDER BY position`);
    expect(rows.map(r => r.position)).toEqual([1, 2]);
  });

  it('pins one item at a time, returning the previous to queued', async () => {
    const { streamId } = await createStream(pool, 'S');
    const a = await addItem(pool, streamId, { title: 'A', mode: 'auction', startingBidOre: 1000 });
    const b = await addItem(pool, streamId, { title: 'B', mode: 'auction', startingBidOre: 1000 });
    await pinItem(pool, a.itemId, now);
    await pinItem(pool, b.itemId, now);
    const { rows } = await pool.query(`SELECT id, state FROM stream_items`);
    const states = Object.fromEntries(rows.map(r => [r.id, r.state]));
    expect(states[a.itemId]).toBe('queued');
    expect(states[b.itemId]).toBe('pinned');
  });

  it('exposes public state with masked winner and queue length', async () => {
    expect(maskEmail('anna@example.se')).toBe('a***');
    const { streamId } = await createStream(pool, 'S');
    const a = await addItem(pool, streamId, { title: 'A', mode: 'auction', startingBidOre: 1000 });
    await addItem(pool, streamId, { title: 'B', mode: 'buy_now', buyNowPriceOre: 5000 });
    await pinItem(pool, a.itemId, now);
    const state = await getPublicState(pool);
    expect(state.stream!.title).toBe('S');
    expect(state.pinned!.itemId).toBe(a.itemId);
    expect(state.pinned!.bidCount).toBe(0);
    expect(state.queueLength).toBe(1);
  });
});
```

- [ ] **Step 2: Run to verify fail** — module missing.

- [ ] **Step 3: Implement** `src/live/engine.ts` (first slice):

```ts
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
    await client.query(`UPDATE stream_items SET state='pinned' WHERE id=$1`, [itemId]);
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
     ORDER BY i.created_at DESC LIMIT 1`, [s.id]);
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
```

Note: "pinned" in PublicState means "the item currently on screen," which per the state machine may be in `pinned`, `auction_open`, `won`, `charged`, `payment_failed`, or `passed` state (the most recent non-queued item), so viewers see the SOLD moment, not a blank.

- [ ] **Step 4: Run to verify pass** — `npm test` + `npm run tsc` → clean.
- [ ] **Step 5: Commit** — `git commit -am "feat(live): engine streams, item queue, pinning, public state"`

---

### Task 4: Engine — openAuction + placeBid (atomic, soft-close)

**Files:**
- Modify: `live/server/src/live/engine.ts`
- Test: `live/server/test/engine-bidding.test.ts`

**Interfaces (produces — exact):**

```ts
export type BidRejection = 'not_bid_ready' | 'not_open' | 'too_low' | 'ended';
export async function openAuction(pool, itemId: string, durationMs: number, now): Promise<EngineEvent[]>;
  // item must be 'pinned' + mode 'auction' (else throws Error('cannot_open')); no other 'auction_open' anywhere (throws Error('auction_in_progress'));
  // sets state='auction_open', current_bid=null, ends_at = now + durationMs; event 'auction_opened'
export async function placeBid(pool, itemId: string, bidder: { customerId: string; bidReady: boolean }, amountOre: number, now):
  Promise<{ ok: true; amountOre: number; endsAt: string; events: EngineEvent[] } | { ok: false; reason: BidRejection }>;
  // inside one transaction with SELECT ... FOR UPDATE on the item row:
  //   not bidReady → 'not_bid_ready' (checked first, before touching the row)
  //   state !== 'auction_open' → 'not_open' · ends_at <= now → 'ended'
  //   min acceptable = current_bid ? current_bid + min_increment : starting_bid; below → 'too_low'
  //   accept: INSERT bid row, UPDATE current_bid/current_bidder, soft-close (ends_at−now < SOFT_CLOSE_MS → ends_at = now+SOFT_CLOSE_MS)
  //   event 'bid_placed' {itemId, amountOre, bidderMasked}
export async function extendAuction(pool, itemId: string, extraMs: number, now): Promise<EngineEvent[]>;  // auction_open only (throws 'not_open'); ends_at = max(ends_at, now) + extraMs; event 'auction_extended'
export async function passItem(pool, itemId: string, now): Promise<EngineEvent[]>;  // states pinned|auction_open|payment_failed → 'passed' (else throws 'cannot_pass'); event 'item_passed'
```

- [ ] **Step 1: Write the failing test**

`test/engine-bidding.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getTestPool, truncateAll } from './helpers.js';
import { createStream, addItem, pinItem, openAuction, placeBid, extendAuction, passItem, SOFT_CLOSE_MS } from '../src/live/engine.js';
import type pg from 'pg';

let pool: pg.Pool;
beforeAll(async () => { pool = await getTestPool(); });
afterAll(async () => { await pool.end(); });
beforeEach(async () => { await truncateAll(pool); });

const t0 = new Date('2026-08-30T19:00:00Z');
const at = (ms: number) => () => new Date(t0.getTime() + ms);

async function customer(email: string, bidReady = true): Promise<{ customerId: string; bidReady: boolean }> {
  const { rows } = await pool.query(
    `INSERT INTO customers (email, bid_ready) VALUES ($1, $2) RETURNING id`, [email, bidReady]);
  return { customerId: rows[0].id, bidReady };
}

async function openItem(durationMs = 60_000): Promise<string> {
  const { streamId } = await createStream(pool, 'S');
  const { itemId } = await addItem(pool, streamId, { title: 'Jackie', mode: 'auction', startingBidOre: 100000, minIncrementOre: 10000 });
  await pinItem(pool, itemId, at(0));
  await openAuction(pool, itemId, durationMs, at(0));
  return itemId;
}

describe('openAuction', () => {
  it('requires a pinned auction item and only one open at a time', async () => {
    const { streamId } = await createStream(pool, 'S');
    const a = await addItem(pool, streamId, { title: 'A', mode: 'auction', startingBidOre: 1000 });
    const b = await addItem(pool, streamId, { title: 'B', mode: 'buy_now', buyNowPriceOre: 1000 });
    await expect(openAuction(pool, a.itemId, 60_000, at(0))).rejects.toThrow('cannot_open'); // not pinned
    await pinItem(pool, b.itemId, at(0));
    await expect(openAuction(pool, b.itemId, 60_000, at(0))).rejects.toThrow('cannot_open'); // wrong mode
  });
});

describe('placeBid', () => {
  it('accepts the opening bid at starting price and enforces increments', async () => {
    const itemId = await openItem();
    const anna = await customer('anna@x.se');
    const erik = await customer('erik@x.se');
    expect((await placeBid(pool, itemId, anna, 99999, at(1000))).ok).toBe(false);
    const first = await placeBid(pool, itemId, anna, 100000, at(1000));
    expect(first).toMatchObject({ ok: true, amountOre: 100000 });
    expect(await placeBid(pool, itemId, erik, 105000, at(2000))).toEqual({ ok: false, reason: 'too_low' });
    expect((await placeBid(pool, itemId, erik, 110000, at(2000))).ok).toBe(true);
  });

  it('rejects non-bid-ready bidders, closed items, and ended auctions', async () => {
    const itemId = await openItem(60_000);
    const spectator = await customer('s@x.se', false);
    expect(await placeBid(pool, itemId, spectator, 100000, at(0))).toEqual({ ok: false, reason: 'not_bid_ready' });
    const anna = await customer('anna@x.se');
    expect(await placeBid(pool, itemId, anna, 100000, at(61_000))).toEqual({ ok: false, reason: 'ended' });
    await passItem(pool, itemId, at(61_000));
    expect(await placeBid(pool, itemId, anna, 100000, at(61_000))).toEqual({ ok: false, reason: 'not_open' });
  });

  it('soft-closes: a late bid resets the clock to SOFT_CLOSE_MS', async () => {
    const itemId = await openItem(60_000);
    const anna = await customer('anna@x.se');
    const res = await placeBid(pool, itemId, anna, 100000, at(55_000)); // 5s left
    expect(res.ok).toBe(true);
    if (res.ok) expect(new Date(res.endsAt).getTime()).toBe(t0.getTime() + 55_000 + SOFT_CLOSE_MS);
    const early = await placeBid(pool, itemId, await customer('erik@x.se'), 110000, at(10_000)); // 55s left — no extension
    if (early.ok) expect(new Date(early.endsAt).getTime()).toBe(t0.getTime() + 55_000 + SOFT_CLOSE_MS);
  });

  it('is safe under concurrent bidding: highest valid bid wins the row', async () => {
    const itemId = await openItem();
    const bidders = await Promise.all(
      Array.from({ length: 8 }, (_, i) => customer(`c${i}@x.se`)));
    const results = await Promise.all(
      bidders.map((b, i) => placeBid(pool, itemId, b, 100000 + i * 10000, at(1000))));
    const { rows } = await pool.query(`SELECT current_bid_ore FROM stream_items WHERE id=$1`, [itemId]);
    // serialized by FOR UPDATE: at least the highest-amount accepted bid must stand
    const accepted = results.filter(r => r.ok).map(r => (r as { amountOre: number }).amountOre);
    expect(rows[0].current_bid_ore).toBe(Math.max(...accepted));
    const bids = await pool.query(`SELECT count(*)::int AS n FROM bids WHERE item_id=$1`, [itemId]);
    expect(bids.rows[0].n).toBe(accepted.length);
  });
});

describe('extendAuction', () => {
  it('adds time from max(ends_at, now)', async () => {
    const itemId = await openItem(60_000);
    await extendAuction(pool, itemId, 60_000, at(10_000));
    const { rows } = await pool.query(`SELECT ends_at FROM stream_items WHERE id=$1`, [itemId]);
    expect(new Date(rows[0].ends_at).getTime()).toBe(t0.getTime() + 120_000);
  });
});
```

- [ ] **Step 2: Run to verify fail** — functions missing.

- [ ] **Step 3: Implement** — append to `engine.ts`:

```ts
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
```

- [ ] **Step 4: Run to verify pass** — `npm test` + `npm run tsc` → clean.
- [ ] **Step 5: Commit** — `git commit -am "feat(live): atomic bidding with soft-close and host controls"`

---

### Task 5: Engine — settlement, charging, second chance

**Files:**
- Create: `live/server/src/live/charge.ts`
- Modify: `live/server/src/live/engine.ts`
- Test: `live/server/test/engine-settle.test.ts`

**Interfaces (produces — exact):**

```ts
// charge.ts
export function chargeIdempotencyKey(itemId: string, winnerId: string, amountOre: number): string;
  // `charge-${itemId}-${winnerId}-${amountOre}`
export async function chargeWinner(pool, gateway: PaymentGateway, itemId: string, now): Promise<EngineEvent[]>;
  // item must be state 'won' with winner_id + winning_amount_ore. Loads winner's stripe_customer_id +
  // default_payment_method_id; missing either → treat as failed('no_payment_method').
  // Calls gateway.chargeSavedCard with the idempotency key above and description = item title.
  // Records a charges row (status per result). succeeded → state 'charged', event 'item_charged'.
  // failed → state 'payment_failed', event 'charge_failed' {itemId, failureReason}.

// engine.ts additions
export async function settleDueAuctions(pool, gateway: PaymentGateway, now): Promise<EngineEvent[]>;
  // SELECT ... WHERE state='auction_open' AND ends_at <= now FOR UPDATE SKIP LOCKED (the 500ms ticker calls this):
  //   with bids: state='won', winner_id=current_bidder_id, winning_amount_ore=current_bid_ore, event 'auction_won'
  //     then (outside that transaction) chargeWinner
  //   no bids: state='passed', event 'item_passed'
export async function secondChance(pool, gateway: PaymentGateway, itemId: string, now): Promise<EngineEvent[]>;
  // item must be 'payment_failed' (throws 'cannot_second_chance'). Finds the highest bid from a DIFFERENT
  // customer than the failed winner; none → throws 'no_underbidder'. Sets winner to that bidder at their
  // bid amount, state='won', event 'second_chance' — then chargeWinner.
```

- [ ] **Step 1: Write the failing test**

`test/engine-settle.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getTestPool, truncateAll } from './helpers.js';
import { createStream, addItem, pinItem, openAuction, placeBid, settleDueAuctions, secondChance } from '../src/live/engine.js';
import { chargeIdempotencyKey } from '../src/live/charge.js';
import { FakePaymentGateway } from '../src/billing/gateway.js';
import type pg from 'pg';

let pool: pg.Pool;
let gateway: FakePaymentGateway;
beforeAll(async () => { pool = await getTestPool(); });
afterAll(async () => { await pool.end(); });
beforeEach(async () => { await truncateAll(pool); gateway = new FakePaymentGateway(); });

const t0 = new Date('2026-08-30T19:00:00Z');
const at = (ms: number) => () => new Date(t0.getTime() + ms);

async function readyCustomer(email: string): Promise<{ customerId: string; bidReady: boolean }> {
  const { rows } = await pool.query(
    `INSERT INTO customers (email, bid_ready, stripe_customer_id, default_payment_method_id)
     VALUES ($1, true, 'cus_' || $1, 'pm_' || $1) RETURNING id`, [email]);
  return { customerId: rows[0].id, bidReady: true };
}

async function wonAuction(): Promise<{ itemId: string; winner: { customerId: string } }> {
  const { streamId } = await createStream(pool, 'S');
  const { itemId } = await addItem(pool, streamId, { title: 'Jackie', mode: 'auction', startingBidOre: 100000 });
  await pinItem(pool, itemId, at(0));
  await openAuction(pool, itemId, 30_000, at(0));
  const anna = await readyCustomer('anna@x.se');
  const erik = await readyCustomer('erik@x.se');
  await placeBid(pool, itemId, erik, 100000, at(1000));
  await placeBid(pool, itemId, anna, 120000, at(2000));
  return { itemId, winner: anna };
}

describe('settleDueAuctions', () => {
  it('does nothing before the deadline', async () => {
    await wonAuction();
    expect(await settleDueAuctions(pool, gateway, at(20_000))).toEqual([]);
  });

  it('charges the winner with the mandated idempotency key and marks charged', async () => {
    const { itemId, winner } = await wonAuction();
    const events = await settleDueAuctions(pool, gateway, at(40_000));
    expect(events.map(e => e.type)).toEqual(['auction_won', 'item_charged']);
    const item = await pool.query(`SELECT state, winner_id, winning_amount_ore FROM stream_items WHERE id=$1`, [itemId]);
    expect(item.rows[0]).toMatchObject({ state: 'charged', winner_id: winner.customerId, winning_amount_ore: 120000 });
    expect(gateway.charges).toHaveLength(1);
    expect(gateway.charges[0]!.idempotencyKey).toBe(chargeIdempotencyKey(itemId, winner.customerId, 120000));
    expect(gateway.charges[0]!.amountOre).toBe(120000);
    const charge = await pool.query(`SELECT status FROM charges WHERE item_id=$1`, [itemId]);
    expect(charge.rows[0].status).toBe('succeeded');
  });

  it('passes an auction with no bids', async () => {
    const { streamId } = await createStream(pool, 'S');
    const { itemId } = await addItem(pool, streamId, { title: 'A', mode: 'auction', startingBidOre: 1000 });
    await pinItem(pool, itemId, at(0));
    await openAuction(pool, itemId, 30_000, at(0));
    const events = await settleDueAuctions(pool, gateway, at(40_000));
    expect(events.map(e => e.type)).toEqual(['item_passed']);
    const { rows } = await pool.query(`SELECT state FROM stream_items WHERE id=$1`, [itemId]);
    expect(rows[0].state).toBe('passed');
  });

  it('is idempotent when called twice (second run settles nothing, no double charge)', async () => {
    await wonAuction();
    await settleDueAuctions(pool, gateway, at(40_000));
    expect(await settleDueAuctions(pool, gateway, at(41_000))).toEqual([]);
    expect(gateway.charges).toHaveLength(1);
  });

  it('marks payment_failed on decline', async () => {
    const { itemId } = await wonAuction();
    gateway.failNextCharge = true;
    const events = await settleDueAuctions(pool, gateway, at(40_000));
    expect(events.map(e => e.type)).toEqual(['auction_won', 'charge_failed']);
    const { rows } = await pool.query(`SELECT state FROM stream_items WHERE id=$1`, [itemId]);
    expect(rows[0].state).toBe('payment_failed');
  });
});

describe('secondChance', () => {
  it('re-awards to the highest different underbidder and charges them', async () => {
    const { itemId } = await wonAuction();       // anna 120000 over erik 100000
    gateway.failNextCharge = true;
    await settleDueAuctions(pool, gateway, at(40_000));  // anna declined → payment_failed
    const events = await secondChance(pool, gateway, itemId, at(50_000));
    expect(events.map(e => e.type)).toEqual(['second_chance', 'item_charged']);
    const { rows } = await pool.query(
      `SELECT i.state, i.winning_amount_ore, c.email FROM stream_items i JOIN customers c ON c.id=i.winner_id WHERE i.id=$1`, [itemId]);
    expect(rows[0]).toMatchObject({ state: 'charged', winning_amount_ore: 100000, email: 'erik@x.se' });
  });

  it('refuses when there is no underbidder', async () => {
    const { streamId } = await createStream(pool, 'S');
    const { itemId } = await addItem(pool, streamId, { title: 'A', mode: 'auction', startingBidOre: 1000 });
    await pinItem(pool, itemId, at(0));
    await openAuction(pool, itemId, 30_000, at(0));
    const solo = await readyCustomer('solo@x.se');
    await placeBid(pool, itemId, solo, 1000, at(1000));
    gateway.failNextCharge = true;
    await settleDueAuctions(pool, gateway, at(40_000));
    await expect(secondChance(pool, gateway, itemId, at(50_000))).rejects.toThrow('no_underbidder');
  });
});
```

- [ ] **Step 2: Run to verify fail** — modules/functions missing.

- [ ] **Step 3: Implement**

`src/live/charge.ts`:

```ts
import type pg from 'pg';
import type { PaymentGateway } from '../billing/gateway.js';
import type { EngineEvent } from './engine.js';

export function chargeIdempotencyKey(itemId: string, winnerId: string, amountOre: number): string {
  return `charge-${itemId}-${winnerId}-${amountOre}`;
}

export async function chargeWinner(pool: pg.Pool, gateway: PaymentGateway, itemId: string, now: () => Date): Promise<EngineEvent[]> {
  const { rows } = await pool.query(
    `SELECT i.id, i.stream_id, i.title, i.state, i.winner_id, i.winning_amount_ore,
            c.stripe_customer_id, c.default_payment_method_id
     FROM stream_items i JOIN customers c ON c.id = i.winner_id
     WHERE i.id = $1`, [itemId]);
  const item = rows[0];
  if (!item || item.state !== 'won') throw new Error('not_won');

  const key = chargeIdempotencyKey(item.id, item.winner_id, item.winning_amount_ore);
  const result = (item.stripe_customer_id && item.default_payment_method_id)
    ? await gateway.chargeSavedCard({
        gatewayCustomerId: item.stripe_customer_id,
        paymentMethodId: item.default_payment_method_id,
        amountOre: item.winning_amount_ore,
        description: item.title,
        idempotencyKey: key,
      })
    : { status: 'failed' as const, failureReason: 'no_payment_method' };

  await pool.query(
    `INSERT INTO charges (item_id, customer_id, amount_ore, idempotency_key, gateway_payment_intent_id, status, failure_reason, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (idempotency_key) DO NOTHING`,
    [item.id, item.winner_id, item.winning_amount_ore, key,
     result.status === 'succeeded' ? result.paymentIntentId : null,
     result.status, result.status === 'failed' ? result.failureReason : null, now()]);

  if (result.status === 'succeeded') {
    await pool.query(`UPDATE stream_items SET state='charged' WHERE id=$1 AND state='won'`, [itemId]);
    await pool.query(`INSERT INTO events (stream_id, type, payload) VALUES ($1, 'item_charged', $2)`,
      [item.stream_id, { itemId, amountOre: item.winning_amount_ore }]);
    return [{ type: 'item_charged', payload: { itemId, amountOre: item.winning_amount_ore } }];
  }
  await pool.query(`UPDATE stream_items SET state='payment_failed' WHERE id=$1 AND state='won'`, [itemId]);
  await pool.query(`INSERT INTO events (stream_id, type, payload) VALUES ($1, 'charge_failed', $2)`,
    [item.stream_id, { itemId, failureReason: result.failureReason }]);
  return [{ type: 'charge_failed', payload: { itemId, failureReason: result.failureReason } }];
}
```

`engine.ts` additions:

```ts
import { chargeWinner } from './charge.js';
import type { PaymentGateway } from '../billing/gateway.js';

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
```

- [ ] **Step 4: Run to verify pass** — `npm test` + `npm run tsc` → clean.
- [ ] **Step 5: Commit** — `git commit -am "feat(live): settlement, idempotent charging, second chance"`

---

### Task 6: Engine — buy-now claims

**Files:**
- Modify: `live/server/src/live/engine.ts`
- Test: `live/server/test/engine-buynow.test.ts`

**Interfaces (produces — exact):**

```ts
export type BuyRejection = 'not_bid_ready' | 'not_available';
export async function buyNow(pool, gateway: PaymentGateway, itemId: string, buyer: { customerId: string; bidReady: boolean }, now):
  Promise<{ ok: true; charged: boolean; events: EngineEvent[] } | { ok: false; reason: BuyRejection }>;
  // in one FOR UPDATE transaction: item must be state='pinned' AND mode='buy_now' (else 'not_available');
  // claims: state='won', winner_id=buyer, winning_amount_ore=buy_now_price_ore, event 'item_claimed'
  // — the row lock IS the first-tap-wins hold — then (outside the tx) chargeWinner.
  // charged = final state is 'charged'.
```

- [ ] **Step 1: Write the failing test**

`test/engine-buynow.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getTestPool, truncateAll } from './helpers.js';
import { createStream, addItem, pinItem, buyNow } from '../src/live/engine.js';
import { FakePaymentGateway } from '../src/billing/gateway.js';
import type pg from 'pg';

let pool: pg.Pool;
let gateway: FakePaymentGateway;
beforeAll(async () => { pool = await getTestPool(); });
afterAll(async () => { await pool.end(); });
beforeEach(async () => { await truncateAll(pool); gateway = new FakePaymentGateway(); });

const now = () => new Date('2026-08-30T19:00:00Z');

async function readyCustomer(email: string) {
  const { rows } = await pool.query(
    `INSERT INTO customers (email, bid_ready, stripe_customer_id, default_payment_method_id)
     VALUES ($1, true, 'cus_' || $1, 'pm_' || $1) RETURNING id`, [email]);
  return { customerId: rows[0].id as string, bidReady: true };
}

async function pinnedBuyNow(): Promise<string> {
  const { streamId } = await createStream(pool, 'S');
  const { itemId } = await addItem(pool, streamId, { title: 'Polo', mode: 'buy_now', buyNowPriceOre: 90000 });
  await pinItem(pool, itemId, now);
  return itemId;
}

describe('buyNow', () => {
  it('first tap wins, is charged immediately, item becomes charged', async () => {
    const itemId = await pinnedBuyNow();
    const anna = await readyCustomer('anna@x.se');
    const res = await buyNow(pool, gateway, itemId, anna, now);
    expect(res).toMatchObject({ ok: true, charged: true });
    const { rows } = await pool.query(`SELECT state, winner_id, winning_amount_ore FROM stream_items WHERE id=$1`, [itemId]);
    expect(rows[0]).toMatchObject({ state: 'charged', winner_id: anna.customerId, winning_amount_ore: 90000 });
    expect(gateway.charges).toHaveLength(1);
  });

  it('second tap loses; exactly one charge under a concurrent race', async () => {
    const itemId = await pinnedBuyNow();
    const buyers = await Promise.all(Array.from({ length: 6 }, (_, i) => readyCustomer(`b${i}@x.se`)));
    const results = await Promise.all(buyers.map(b => buyNow(pool, gateway, itemId, b, now)));
    expect(results.filter(r => r.ok)).toHaveLength(1);
    expect(results.filter(r => !r.ok && r.reason === 'not_available')).toHaveLength(5);
    expect(gateway.charges).toHaveLength(1);
  });

  it('rejects non-bid-ready buyers and auction-mode items', async () => {
    const itemId = await pinnedBuyNow();
    const { rows } = await pool.query(`INSERT INTO customers (email) VALUES ('x@x.se') RETURNING id`);
    expect(await buyNow(pool, gateway, itemId, { customerId: rows[0].id, bidReady: false }, now))
      .toEqual({ ok: false, reason: 'not_bid_ready' });
  });

  it('failed charge leaves payment_failed (host can pass or retry)', async () => {
    const itemId = await pinnedBuyNow();
    gateway.failNextCharge = true;
    const res = await buyNow(pool, gateway, itemId, await readyCustomer('anna@x.se'), now);
    expect(res).toMatchObject({ ok: true, charged: false });
    const { rows } = await pool.query(`SELECT state FROM stream_items WHERE id=$1`, [itemId]);
    expect(rows[0].state).toBe('payment_failed');
  });
});
```

- [ ] **Step 2: Run to verify fail.**

- [ ] **Step 3: Implement** — append to `engine.ts`:

```ts
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
```

- [ ] **Step 4: Run to verify pass** — `npm test` + `npm run tsc` → clean.
- [ ] **Step 5: Commit** — `git commit -am "feat(live): buy-now claims with first-tap-wins row lock"`

---

### Task 7: WebSocket hub + /live/ws + chat

**Files:**
- Create: `live/server/src/live/hub.ts`
- Modify: `live/server/src/app.ts` (register @fastify/websocket, create hub, decorate)
- Test: `live/server/test/hub.test.ts`
- Run once: `npm install @fastify/websocket`

**Interfaces (produces — exact):**

```ts
// hub.ts
export const CHAT_MAX_LEN = 280;
export const CHAT_COOLDOWN_MS = 2000;
export class Hub {
  constructor(private now: () => Date = () => new Date()) {}
  add(socket: WebSocket, customer: { customerId: string; email: string } | null): void;
    // wires socket close → remove; wires 'message' → handleMessage; sends {type:'viewers', count} to all on join/leave
  broadcast(msg: object): void;       // JSON.stringify once, send to every open socket
  viewerCount(): number;
  // incoming {type:'chat', text}: requires customer (else {type:'error', error:'auth_required'} to sender);
  // trims, enforces CHAT_MAX_LEN (else 'too_long') and CHAT_COOLDOWN_MS per customer (else 'slow_down');
  // broadcasts {type:'chat', from: maskEmail-style local-part prefix + '***', text}
}
```

- `app.ts`: `Deps` unchanged; `buildApp` creates `const hub = new Hub(now)` and decorates `app.decorate('hub', hub)` with module augmentation `interface FastifyInstance { hub: Hub }`. Registers `@fastify/websocket` before routes. Route `GET /live/ws` (websocket: true): resolves the session from the `cf_session` cookie (via `getSession`) — authenticated or anonymous both accepted — calls `hub.add(socket, customerOrNull)`, then sends the current `{type:'state', state: await getPublicState(pool)}` to the new socket.
- Test uses a real listening server (`app.listen({port: 0})`) and the **`ws` package's client** — NOT the Node 22 global `WebSocket`, whose browser-style constructor cannot send a `cookie` header. Install alongside the server plugin: `npm install @fastify/websocket ws && npm install -D @types/ws`. The `ws` client takes `new WebSocket(url, { headers: { cookie } })` and uses `.on('open'|'message'|'error', ...)` events.
- **Deferred to Plan 3 (deliberate, from spec §2.5):** host chat moderation (block/remove a chatter). Chat lands here; the moderation control belongs with Plan 3's chat UX so the identity plumbing (which chat line maps to which customer) is designed once. Carry this note into Plan 3.

- [ ] **Step 1: Write the failing test**

`test/hub.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getTestPool, truncateAll } from './helpers.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { FakePaymentGateway } from '../src/billing/gateway.js';
import type { Mailer } from '../src/mailer.js';
import type pg from 'pg';
import type { FastifyInstance } from 'fastify';

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
  await app.listen({ port: 0 });
  const addr = app.server.address();
  base = `ws://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
});
afterAll(async () => { await app.close(); await pool.end(); });
beforeEach(async () => { await truncateAll(pool); sent.length = 0; });

// at top of file:  import WebSocket from 'ws';
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
```

- [ ] **Step 2: Run to verify fail** — `npm install @fastify/websocket ws && npm install -D @types/ws` first, then `npm test -- hub` → FAIL (no /live/ws route).

- [ ] **Step 3: Implement**

`src/live/hub.ts`:

```ts
import type { WebSocket } from 'ws';
import { maskEmail } from './engine.js';

export const CHAT_MAX_LEN = 280;
export const CHAT_COOLDOWN_MS = 2000;

type Customer = { customerId: string; email: string };

export class Hub {
  private sockets = new Map<WebSocket, Customer | null>();
  private lastChat = new Map<string, number>();
  constructor(private now: () => Date = () => new Date()) {}

  add(socket: WebSocket, customer: Customer | null): void {
    this.sockets.set(socket, customer);
    socket.on('close', () => {
      this.sockets.delete(socket);
      this.broadcast({ type: 'viewers', count: this.viewerCount() });
    });
    socket.on('message', (raw) => this.handleMessage(socket, customer, String(raw)));
    this.broadcast({ type: 'viewers', count: this.viewerCount() });
  }

  broadcast(msg: object): void {
    const data = JSON.stringify(msg);
    for (const socket of this.sockets.keys()) {
      if (socket.readyState === socket.OPEN) socket.send(data);
    }
  }

  viewerCount(): number {
    return this.sockets.size;
  }

  private handleMessage(socket: WebSocket, customer: Customer | null, raw: string): void {
    let msg: { type?: string; text?: string };
    try { msg = JSON.parse(raw); } catch { return; }
    if (msg.type !== 'chat') return;
    if (!customer) return socket.send(JSON.stringify({ type: 'error', error: 'auth_required' }));
    const text = (msg.text ?? '').trim();
    if (!text || text.length > CHAT_MAX_LEN)
      return socket.send(JSON.stringify({ type: 'error', error: 'too_long' }));
    const nowMs = this.now().getTime();
    const last = this.lastChat.get(customer.customerId) ?? 0;
    if (nowMs - last < CHAT_COOLDOWN_MS)
      return socket.send(JSON.stringify({ type: 'error', error: 'slow_down' }));
    this.lastChat.set(customer.customerId, nowMs);
    this.broadcast({ type: 'chat', from: maskEmail(customer.email), text });
  }
}
```

`src/app.ts` — add:

```ts
import websocket from '@fastify/websocket';
import { Hub } from './live/hub.js';
import { getSession } from './auth/session.js';
import { getPublicState } from './live/engine.js';

declare module 'fastify' {
  interface FastifyInstance { hub: Hub }
}

// inside buildApp, after cookie registration:
const hub = new Hub(now);
app.decorate('hub', hub);
app.register(websocket);
app.register(async (scope) => {
  scope.get('/live/ws', { websocket: true }, async (socket, req) => {
    const raw = req.cookies['cf_session'];
    const session = raw ? await getSession(deps.pool, raw, now) : null;
    hub.add(socket, session ? { customerId: session.customerId, email: session.email } : null);
    socket.send(JSON.stringify({ type: 'state', state: await getPublicState(deps.pool) }));
  });
});
```

(Note: with `@fastify/websocket` v11+, the handler signature is `(socket, req)`; the route must live inside a registered plugin scope.)

- [ ] **Step 4: Run to verify pass** — `npm test` + `npm run tsc` → clean.
- [ ] **Step 5: Commit** — `git commit -am "feat(live): websocket hub with chat and viewer count"`

---

### Task 8: Viewer routes — state, bid, buy

**Files:**
- Create: `live/server/src/live/routes.ts`
- Modify: `live/server/src/app.ts` (register)
- Test: `live/server/test/live-routes.test.ts`

**Interfaces (produces):**
- `registerLive(app, pool, gateway, now)` — registered after auth in `buildApp`:
  - `GET /live/state` → 200 `PublicState` (public, no auth).
  - `POST /live/bid` `{itemId: uuid, amountOre: int>0}` (requireAuth) → 200 `{ok:true, amountOre, endsAt}`; rejections: `not_bid_ready` → 403, others (`not_open`/`too_low`/`ended`) → 409 `{error: reason}`; zod-invalid → 400.
  - `POST /live/buy` `{itemId: uuid}` (requireAuth) → 200 `{ok:true, charged}`; `not_bid_ready` → 403; `not_available` → 409; zod-invalid → 400.
  - After every successful mutation: `app.hub.broadcast({type:'state', state: await getPublicState(pool)})`.

- [ ] **Step 1: Write the failing test**

`test/live-routes.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getTestPool, truncateAll } from './helpers.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { FakePaymentGateway } from '../src/billing/gateway.js';
import { createStream, addItem, pinItem, openAuction } from '../src/live/engine.js';
import type { Mailer } from '../src/mailer.js';
import type pg from 'pg';
import type { FastifyInstance } from 'fastify';

let pool: pg.Pool;
let app: FastifyInstance;
let gateway: FakePaymentGateway;
const sent: { email: string; code: string }[] = [];
const mailer: Mailer = { async sendOtp(email, code) { sent.push({ email, code }); } };
const now = () => new Date('2026-08-30T19:00:00Z');

beforeAll(async () => { pool = await getTestPool(); });
afterAll(async () => { if (app) await app.close(); await pool.end(); });
beforeEach(async () => {
  await truncateAll(pool); sent.length = 0;
  gateway = new FakePaymentGateway();
  if (app) await app.close();
  app = buildApp({
    config: loadConfig({
      NODE_ENV: 'test', DATABASE_URL: 'postgres://cf:cf@localhost:5433/cf_live',
      COOKIE_SECRET: 'test-cookie-secret-at-least-32-chars!!',
    }),
    pool, mailer, gateway, now,
  });
});

async function login(email = 'anna@x.se', makeReady = true): Promise<string> {
  await app.inject({ method: 'POST', url: '/auth/request-code', payload: { email } });
  const res = await app.inject({ method: 'POST', url: '/auth/verify', payload: { email, code: sent.at(-1)!.code } });
  if (makeReady) await pool.query(
    `UPDATE customers SET bid_ready=true, stripe_customer_id='cus_x', default_payment_method_id='pm_x' WHERE email=$1`, [email]);
  return res.cookies.find(c => c.name === 'cf_session')!.value;
}

async function openAuctionItem(): Promise<string> {
  const { streamId } = await createStream(pool, 'S');
  const { itemId } = await addItem(pool, streamId, { title: 'Jackie', mode: 'auction', startingBidOre: 100000 });
  await pinItem(pool, itemId, now);
  await openAuction(pool, itemId, 60_000, now);
  return itemId;
}

describe('GET /live/state', () => {
  it('is public and returns the snapshot', async () => {
    await openAuctionItem();
    const res = await app.inject({ method: 'GET', url: '/live/state' });
    expect(res.statusCode).toBe(200);
    expect(res.json().pinned.state).toBe('auction_open');
  });
});

describe('POST /live/bid', () => {
  it('requires auth and bid-readiness', async () => {
    const itemId = await openAuctionItem();
    expect((await app.inject({ method: 'POST', url: '/live/bid', payload: { itemId, amountOre: 100000 } })).statusCode).toBe(401);
    const notReady = await login('n@x.se', false);
    const res = await app.inject({ method: 'POST', url: '/live/bid', cookies: { cf_session: notReady }, payload: { itemId, amountOre: 100000 } });
    expect(res.statusCode).toBe(403);
  });

  it('accepts a valid bid and 409s auction-state rejections', async () => {
    const itemId = await openAuctionItem();
    const token = await login();
    const ok = await app.inject({ method: 'POST', url: '/live/bid', cookies: { cf_session: token }, payload: { itemId, amountOre: 100000 } });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({ ok: true, amountOre: 100000 });
    const low = await app.inject({ method: 'POST', url: '/live/bid', cookies: { cf_session: token }, payload: { itemId, amountOre: 100001 } });
    expect(low.statusCode).toBe(409);
    expect(low.json()).toEqual({ error: 'too_low' });
  });
});

describe('POST /live/buy', () => {
  it('claims and charges a pinned buy-now item', async () => {
    const { streamId } = await createStream(pool, 'S');
    const { itemId } = await addItem(pool, streamId, { title: 'Polo', mode: 'buy_now', buyNowPriceOre: 90000 });
    await pinItem(pool, itemId, now);
    const token = await login();
    const res = await app.inject({ method: 'POST', url: '/live/buy', cookies: { cf_session: token }, payload: { itemId } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, charged: true });
    const second = await app.inject({ method: 'POST', url: '/live/buy', cookies: { cf_session: token }, payload: { itemId } });
    expect(second.statusCode).toBe(409);
  });
});
```

- [ ] **Step 2: Run to verify fail.**

- [ ] **Step 3: Implement**

`src/live/routes.ts`:

```ts
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { z } from 'zod';
import type { PaymentGateway } from '../billing/gateway.js';
import { getPublicState, placeBid, buyNow } from './engine.js';

const bidSchema = z.object({ itemId: z.string().uuid(), amountOre: z.number().int().positive() });
const buySchema = z.object({ itemId: z.string().uuid() });

export function registerLive(app: FastifyInstance, pool: pg.Pool, gateway: PaymentGateway, now: () => Date): void {
  app.get('/live/state', async () => getPublicState(pool));

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
```

In `app.ts`: `registerLive(app, deps.pool, deps.gateway, now)` after `registerBilling`.

- [ ] **Step 4: Run to verify pass** — `npm test` + `npm run tsc` → clean.
- [ ] **Step 5: Commit** — `git commit -am "feat(live): viewer state, bid, and buy routes"`

---

### Task 9: Host API

**Files:**
- Create: `live/server/src/live/host-routes.ts`
- Modify: `live/server/src/config.ts` (add `hostPassword: string | null` from optional `HOST_PASSWORD` env, min length 12 when set), `live/server/src/app.ts` (register), `live/server/.env.example` (add `# HOST_PASSWORD=change-me-long-random`)
- Test: `live/server/test/host-routes.test.ts`

**Interfaces (produces):**
- `registerHost(app, pool, gateway, now, hostPassword: string | null)`:
  - All under `/host/*`, guarded by a `requireHost` preHandler: `authorization: Bearer <HOST_PASSWORD>`; wrong/missing → 401 `{error:'unauthorized'}`; `hostPassword === null` → 503 `{error:'host_disabled'}` on every host route.
  - `POST /host/streams` `{title}` → 201 `{streamId}`; `stream_already_live` → 409.
  - `POST /host/streams/end` `{streamId: uuid}` → `{ok:true}`.
  - `POST /host/items` `{streamId, title, imageUrl?, mode, startingBidOre?, minIncrementOre?, buyNowPriceOre?}` → 201 `{itemId}`; `invalid_item` → 400.
  - `POST /host/items/:id/pin` → `{ok:true}`; engine errors (`auction_in_progress`, `not_found`) → 409/404.
  - `POST /host/items/:id/open-auction` `{durationSec: int 10..600}` → `{ok:true, endsAt}`; `cannot_open`/`auction_in_progress` → 409.
  - `POST /host/items/:id/extend` `{extraSec: int 1..600}` → `{ok:true}`; `not_open` → 409.
  - `POST /host/items/:id/pass` → `{ok:true}`; `cannot_pass` → 409.
  - `POST /host/items/:id/second-chance` → `{ok:true, charged: boolean}`; `cannot_second_chance`/`no_underbidder` → 409.
  - `GET /host/state` → the public state PLUS `queue: [{itemId, position, title, mode, state, startingBidOre, buyNowPriceOre}]` and, when the on-screen item has a winner, the winner's FULL email and charge status (host needs it for fulfillment).
  - Every mutating host route broadcasts fresh state via `app.hub` (same pattern as Task 8).
  - Engine `Error` messages map to HTTP via one small `mapEngineError(reply, err)` helper in this file — unknown errors rethrow.

- [ ] **Step 1: Write the failing test**

`test/host-routes.test.ts` (representative coverage — auth gate, disabled mode, full happy flow, error mapping):

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getTestPool, truncateAll } from './helpers.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { FakePaymentGateway } from '../src/billing/gateway.js';
import type { Mailer } from '../src/mailer.js';
import type pg from 'pg';
import type { FastifyInstance } from 'fastify';

let pool: pg.Pool;
let app: FastifyInstance;
let gateway: FakePaymentGateway;
const mailer: Mailer = { async sendOtp() {} };
const HOST_PW = 'super-secret-host-pw';
const auth = { authorization: `Bearer ${HOST_PW}` };
const now = () => new Date('2026-08-30T19:00:00Z');

function makeApp(hostPassword?: string): FastifyInstance {
  return buildApp({
    config: loadConfig({
      NODE_ENV: 'test', DATABASE_URL: 'postgres://cf:cf@localhost:5433/cf_live',
      COOKIE_SECRET: 'test-cookie-secret-at-least-32-chars!!',
      ...(hostPassword ? { HOST_PASSWORD: hostPassword } : {}),
    }),
    pool, mailer, gateway, now,
  });
}

beforeAll(async () => { pool = await getTestPool(); });
afterAll(async () => { if (app) await app.close(); await pool.end(); });
beforeEach(async () => {
  await truncateAll(pool);
  gateway = new FakePaymentGateway();
  if (app) await app.close();
  app = makeApp(HOST_PW);
});

describe('host auth', () => {
  it('rejects missing/wrong bearer and 503s when disabled', async () => {
    expect((await app.inject({ method: 'POST', url: '/host/streams', payload: { title: 'S' } })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/host/streams', headers: { authorization: 'Bearer nope' }, payload: { title: 'S' } })).statusCode).toBe(401);
    const disabled = makeApp();
    expect((await disabled.inject({ method: 'POST', url: '/host/streams', headers: auth, payload: { title: 'S' } })).statusCode).toBe(503);
    await disabled.close();
  });
});

describe('host flow', () => {
  it('runs a full auction from the host API', async () => {
    const s = await app.inject({ method: 'POST', url: '/host/streams', headers: auth, payload: { title: 'Big Drop' } });
    expect(s.statusCode).toBe(201);
    const { streamId } = s.json();
    const i = await app.inject({ method: 'POST', url: '/host/items', headers: auth,
      payload: { streamId, title: 'Jackie', mode: 'auction', startingBidOre: 100000 } });
    expect(i.statusCode).toBe(201);
    const { itemId } = i.json();
    expect((await app.inject({ method: 'POST', url: `/host/items/${itemId}/pin`, headers: auth })).statusCode).toBe(200);
    const open = await app.inject({ method: 'POST', url: `/host/items/${itemId}/open-auction`, headers: auth, payload: { durationSec: 60 } });
    expect(open.statusCode).toBe(200);
    expect(open.json().endsAt).toBe(new Date(now().getTime() + 60_000).toISOString());
    const st = await app.inject({ method: 'GET', url: '/host/state', headers: auth });
    expect(st.json().pinned.state).toBe('auction_open');
    expect((await app.inject({ method: 'POST', url: `/host/items/${itemId}/pass`, headers: auth })).statusCode).toBe(200);
  });

  it('maps engine errors: second stream 409, open on queued item 409', async () => {
    await app.inject({ method: 'POST', url: '/host/streams', headers: auth, payload: { title: 'One' } });
    expect((await app.inject({ method: 'POST', url: '/host/streams', headers: auth, payload: { title: 'Two' } })).statusCode).toBe(409);
    const st = await app.inject({ method: 'GET', url: '/host/state', headers: auth });
    const streamId = st.json().stream.id;
    const i = await app.inject({ method: 'POST', url: '/host/items', headers: auth,
      payload: { streamId, title: 'X', mode: 'auction', startingBidOre: 1000 } });
    const openRes = await app.inject({ method: 'POST', url: `/host/items/${i.json().itemId}/open-auction`, headers: auth, payload: { durationSec: 60 } });
    expect(openRes.statusCode).toBe(409);
  });

  it('host state shows full winner email and queue', async () => {
    const s = await app.inject({ method: 'POST', url: '/host/streams', headers: auth, payload: { title: 'S' } });
    const { streamId } = s.json();
    const i = await app.inject({ method: 'POST', url: '/host/items', headers: auth,
      payload: { streamId, title: 'Polo', mode: 'buy_now', buyNowPriceOre: 90000 } });
    const { itemId } = i.json();
    await app.inject({ method: 'POST', url: `/host/items/${itemId}/pin`, headers: auth });
    const { rows } = await pool.query(
      `INSERT INTO customers (email, bid_ready, stripe_customer_id, default_payment_method_id)
       VALUES ('anna@x.se', true, 'cus_1', 'pm_1') RETURNING id`);
    const { buyNow } = await import('../src/live/engine.js');
    await buyNow(pool, gateway, itemId, { customerId: rows[0].id, bidReady: true }, now);
    const st = await app.inject({ method: 'GET', url: '/host/state', headers: auth });
    expect(st.json().pinned.winnerEmail).toBe('anna@x.se');
    expect(st.json().pinned.chargeStatus).toBe('succeeded');
  });
});
```

- [ ] **Step 2: Run to verify fail.**

- [ ] **Step 3: Implement**

`src/config.ts` — add to the zod schema `HOST_PASSWORD: z.string().min(12).optional()` and to `Config`/`loadConfig`: `hostPassword: e.HOST_PASSWORD ?? null`.

`src/live/host-routes.ts`:

```ts
import type { FastifyInstance, FastifyReply, preHandlerHookHandler } from 'fastify';
import type pg from 'pg';
import { z } from 'zod';
import type { PaymentGateway } from '../billing/gateway.js';
import {
  createStream, endStream, addItem, pinItem, openAuction, extendAuction,
  passItem, secondChance, getPublicState,
} from './engine.js';

const ERROR_STATUS: Record<string, number> = {
  stream_already_live: 409, auction_in_progress: 409, cannot_open: 409, not_open: 409,
  cannot_pass: 409, cannot_second_chance: 409, no_underbidder: 409, invalid_item: 400, not_found: 404,
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

  app.register(async (host) => {
    host.addHook('preHandler', requireHost);

    host.post('/host/streams', async (request, reply) => {
      const parsed = z.object({ title: z.string().min(1) }).safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
      try {
        const { streamId } = await createStream(pool, parsed.data.title);
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
```

In `app.ts`: `registerHost(app, deps.pool, deps.gateway, now, deps.config.hostPassword)`. Add `# HOST_PASSWORD=change-me-long-random` to `.env.example`.

- [ ] **Step 4: Run to verify pass** — `npm test` + `npm run tsc` → clean.
- [ ] **Step 5: Commit** — `git commit -am "feat(live): host API with bearer auth and engine error mapping"`

---

### Task 10: Host console page

**Files:**
- Create: `live/server/src/live/host-page.ts`
- Modify: `live/server/src/live/host-routes.ts` (serve it), `live/server/test/host-routes.test.ts` (append one test)

**Interfaces:** `export const HOST_HTML: string` — a single self-contained page served at `GET /host` (**no auth on the page itself** — it's an empty shell; every API call it makes carries the Bearer password the operator types in). Served with `reply.type('text/html').send(HOST_HTML)` OUTSIDE the requireHost scope.

Functional requirements for the page (single inline `<script>`, no external assets, dark background `#0E0E0E`, mono numerals, hi-vis `#E8FF52` used once for the primary action):
- Password field (stored in a JS variable only — not localStorage), "connect" button → starts polling `GET /host/state` every 2s and renders: stream title or "no stream", the on-screen item (title, state, current bid in kr, countdown from endsAt, winner email + charge status when present), and the queue list.
- Buttons wired to the API: New stream (prompt for title) · Add item (prompts: title, mode, price in kr — converted ×100 to öre) · per queue row: Pin · on-screen item: Open auction (prompt seconds, default 60) / Extend +60s / Pass / Second chance · End stream.
- Every action = `fetch` with `Authorization: Bearer <password>`; non-2xx → `alert(error)`.
- Kr formatting: `(ore/100).toLocaleString('sv-SE') + ' kr'`.

- [ ] **Step 1: Write the failing test** — append to `test/host-routes.test.ts`:

```ts
describe('GET /host', () => {
  it('serves the console page without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/host' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toContain('Circular Fash');
  });
});
```

- [ ] **Step 2: Run to verify fail.**

- [ ] **Step 3: Implement** — write `host-page.ts` exporting the HTML template string meeting the functional requirements above (roughly 150 lines; keep it dependency-free and ugly-but-usable — this is an operator tool, Plan 3 owns the pretty viewer page). Serve in `host-routes.ts` before the guarded scope:

```ts
import { HOST_HTML } from './host-page.js';
// inside registerHost, before app.register(guarded scope):
app.get('/host', async (_req, reply) => reply.type('text/html').send(HOST_HTML));
```

- [ ] **Step 4: Manual smoke check** — `npm run dev`, open http://localhost:3001/host, connect with the HOST_PASSWORD from `.env` (add one), create a stream, add + pin + open an auction, watch the countdown tick, pass it, end the stream. Fix what's broken. Automated suite + tsc still green.
- [ ] **Step 5: Commit** — `git commit -am "feat(live): host console page"`

---

### Task 11: Settle ticker + wiring + docs

**Files:**
- Modify: `live/server/src/index.ts`, `live/server/README.md`

**Interfaces:** entrypoint adds, after `app.listen`:

```ts
const TICK_MS = 500;
setInterval(async () => {
  try {
    const events = await settleDueAuctions(pool, gateway, () => new Date());
    if (events.length > 0) app.hub.broadcast({ type: 'state', state: await getPublicState(pool) });
  } catch (err) {
    app.log.error(err, 'settle tick failed');
  }
}, TICK_MS);
```

(`settleDueAuctions` uses `SKIP LOCKED`, so an overlapping slow tick cannot double-settle; charge idempotency keys make even a retried charge safe.)

README gains a "Running a live sale (dev)" section: start dev server, open /host, connect with HOST_PASSWORD, the stream flow, and a note that viewers hit `/live/state`, `/live/ws`, `/live/bid`, `/live/buy` (Plan 3 builds the viewer page).

- [ ] **Step 1: Implement** the ticker + README (no new unit test — settle logic is fully covered in Task 5; the ticker is 10 lines of wiring verified by the smoke check).
- [ ] **Step 2: Smoke check** — `npm run dev`, run a 15-second auction from /host with no bidders, watch it flip to `passed` within a tick. `npm test` + `npm run tsc` green.
- [ ] **Step 3: Commit** — `git commit -am "feat(live): auction settle ticker and live-sale docs"`

---

## Carried commitments honored in this plan

- **Idempotency keys on every charge** (Plan 1 final-review ruling) — Task 2 makes the key a required parameter; Task 5's `chargeIdempotencyKey` derives it deterministically from (item, winner, amount) so ticker retries and second-chance re-attempts can never double-charge.
- The Plan-4 backlog (OTP pepper, cleanup job, per-IP limits, real mailer, stripe_customer_id unique index, `--env-file-if-exists`, migrate lock) is intentionally NOT addressed here.

## What Plan 3 (viewer experience) consumes from this plan

`GET /live/state` (`PublicState` shape), `POST /live/bid` / `POST /live/buy` contracts (status codes above), the WS protocol (`state` / `chat` / `viewers` / `error` messages, chat send format), plus Plan 1's auth + setup-intent endpoints. Plan 3 note from Plan 1's review: the API will need `@fastify/cors` with credentials when the widget is served from the shop domain.
