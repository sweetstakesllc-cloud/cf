import type pg from 'pg';
import type { CertificateService } from './service.js';
import type { ShopifyFulfilledOrder } from './types.js';

type Job = { webhook_id: string; payload: ShopifyFulfilledOrder; attempts: number };

export async function processNextCertificateJob(pool: pg.Pool, service: CertificateService): Promise<boolean> {
  const claimed = await pool.query<Job>(`
    UPDATE shopify_webhooks SET status='processing', attempts=attempts+1, last_error=NULL,
      processing_started_at=now()
    WHERE webhook_id = (
      SELECT webhook_id FROM shopify_webhooks
      WHERE (status IN ('pending','failed') AND next_attempt_at <= now())
         OR (status='processing' AND processing_started_at < now() - interval '10 minutes')
      ORDER BY received_at FOR UPDATE SKIP LOCKED LIMIT 1
    ) RETURNING webhook_id, payload, attempts`);
  const job = claimed.rows[0];
  if (!job) return false;
  try {
    if (!job.payload || !Array.isArray(job.payload.line_items)) throw new Error('Invalid Shopify paid-order payload');
    await service.processFulfilledOrder(job.payload);
    await pool.query(`UPDATE shopify_webhooks SET status='completed', processed_at=now(),
      processing_started_at=NULL WHERE webhook_id=$1`, [job.webhook_id]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const delaySeconds = Math.min(3600, 30 * 2 ** Math.min(job.attempts, 7));
    await pool.query(`UPDATE shopify_webhooks SET status='failed', last_error=$2,
      processing_started_at=NULL, next_attempt_at=now()+($3 * interval '1 second') WHERE webhook_id=$1`,
    [job.webhook_id, message.slice(0, 2000), delaySeconds]);
  }
  return true;
}
