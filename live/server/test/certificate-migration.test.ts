import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { expect, it } from 'vitest';

it('preserves an issued certificate when upgrading to certificates per unit', async () => {
  if (!process.env.DATABASE_URL?.includes(':55439/')) throw new Error('Use the isolated certificate test database on port 55439');
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  const schema = 'certificate_migration_' + randomUUID().replaceAll('-', '');
  try {
    await client.query('BEGIN');
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET LOCAL search_path TO ${schema}`);
    await client.query(await readFile(new URL('../migrations/006-authenticity-certificates.sql', import.meta.url), 'utf8'));
    const original = (await client.query(`INSERT INTO authenticity_certificates
      (certificate_number,shopify_order_id,order_name,line_item_id,product_title,pdf_path,emailed_at)
      VALUES('CF-LEGACY','123','#123','456','TEST ONLY','original.pdf',now()) RETURNING *`)).rows[0];
    await client.query(await readFile(new URL('../migrations/012-certificate-units.sql', import.meta.url), 'utf8'));
    const migrated = (await client.query('SELECT * FROM authenticity_certificates')).rows[0];
    expect(migrated).toEqual({ ...original, unit_number: 1 });
    await client.query(`INSERT INTO authenticity_certificates
      (certificate_number,shopify_order_id,order_name,line_item_id,product_title,unit_number)
      VALUES('CF-SECOND','123','#123','456','TEST ONLY',2)`);
    expect((await client.query('SELECT * FROM authenticity_certificates')).rowCount).toBe(2);
  } finally {
    await client.query('ROLLBACK');client.release();await pool.end();
  }
});
