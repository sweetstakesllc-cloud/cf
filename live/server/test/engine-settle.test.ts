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
  it('does nothing before the deadline', { timeout: 30000 }, async () => {
    await wonAuction();
    expect(await settleDueAuctions(pool, gateway, at(20_000))).toEqual([]);
  });

  it('charges the winner with the mandated idempotency key and marks charged', { timeout: 30000 }, async () => {
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

  it('passes an auction with no bids', { timeout: 30000 }, async () => {
    const { streamId } = await createStream(pool, 'S');
    const { itemId } = await addItem(pool, streamId, { title: 'A', mode: 'auction', startingBidOre: 1000 });
    await pinItem(pool, itemId, at(0));
    await openAuction(pool, itemId, 30_000, at(0));
    const events = await settleDueAuctions(pool, gateway, at(40_000));
    expect(events.map(e => e.type)).toEqual(['item_passed']);
    const { rows } = await pool.query(`SELECT state FROM stream_items WHERE id=$1`, [itemId]);
    expect(rows[0].state).toBe('passed');
  });

  it('is idempotent when called twice (second run settles nothing, no double charge)', { timeout: 30000 }, async () => {
    await wonAuction();
    await settleDueAuctions(pool, gateway, at(40_000));
    expect(await settleDueAuctions(pool, gateway, at(41_000))).toEqual([]);
    expect(gateway.charges).toHaveLength(1);
  });

  it('marks payment_failed on decline', { timeout: 30000 }, async () => {
    const { itemId } = await wonAuction();
    gateway.failNextCharge = true;
    const events = await settleDueAuctions(pool, gateway, at(40_000));
    expect(events.map(e => e.type)).toEqual(['auction_won', 'charge_failed']);
    const { rows } = await pool.query(`SELECT state FROM stream_items WHERE id=$1`, [itemId]);
    expect(rows[0].state).toBe('payment_failed');
  });
});

describe('secondChance', () => {
  it('re-awards to the highest different underbidder and charges them', { timeout: 30000 }, async () => {
    const { itemId } = await wonAuction();       // anna 120000 over erik 100000
    gateway.failNextCharge = true;
    await settleDueAuctions(pool, gateway, at(40_000));  // anna declined → payment_failed
    const events = await secondChance(pool, gateway, itemId, at(50_000));
    expect(events.map(e => e.type)).toEqual(['second_chance', 'item_charged']);
    const { rows } = await pool.query(
      `SELECT i.state, i.winning_amount_ore, c.email FROM stream_items i JOIN customers c ON c.id=i.winner_id WHERE i.id=$1`, [itemId]);
    expect(rows[0]).toMatchObject({ state: 'charged', winning_amount_ore: 100000, email: 'erik@x.se' });
  });

  it('refuses when there is no underbidder', { timeout: 30000 }, async () => {
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

  it('does not re-award a prior failed charger even if they are the remaining underbidder', { timeout: 30000 }, async () => {
    const { itemId } = await wonAuction(); // anna 120000 over erik 100000
    gateway.failNextCharge = true;
    await settleDueAuctions(pool, gateway, at(40_000)); // anna declined → payment_failed
    gateway.failNextCharge = true;
    const events = await secondChance(pool, gateway, itemId, at(50_000)); // erik awarded, also declines
    expect(events.map(e => e.type)).toEqual(['second_chance', 'charge_failed']);
    const { rows } = await pool.query(`SELECT state FROM stream_items WHERE id=$1`, [itemId]);
    expect(rows[0].state).toBe('payment_failed');
    // Only anna and erik ever bid, and both have now failed a charge on this item — no valid
    // underbidder remains, so secondChance must refuse rather than re-award anna again.
    await expect(secondChance(pool, gateway, itemId, at(60_000))).rejects.toThrow('no_underbidder');
  });
});
