import pg from 'pg';

export function createPool(databaseUrl: string): pg.Pool {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 10, connectionTimeoutMillis:5000, idleTimeoutMillis:30000 });
  pool.on('error',()=>console.error('PostgreSQL idle connection failed; the pool will replace it'));
  return pool;
}
