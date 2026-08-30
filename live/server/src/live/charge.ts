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
