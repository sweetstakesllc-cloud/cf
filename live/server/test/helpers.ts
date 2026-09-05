import pg from 'pg';
import { createPool } from '../src/db.js';
import { runMigrations } from '../scripts/migrate.js';

const TEST_DB_URL = process.env.DATABASE_URL ?? 'postgres://cf:cf@localhost:5433/cf_live';

export async function getTestPool(): Promise<pg.Pool> {
  const pool = createPool(TEST_DB_URL);
  await runMigrations(pool);
  return pool;
}

export async function truncateAll(pool: pg.Pool): Promise<void> {
  await pool.query(`TRUNCATE authenticity_certificates, shopify_webhooks,
    events, charges, bids, stream_items, streams, sessions, otp_codes, customers CASCADE`);
}
