import pg from 'pg';
import { requireDatabaseUrl } from './env';

const { Pool } = pg;

const globalForDb = globalThis as unknown as {
  conn: pg.Pool | undefined;
};

/** Shared Postgres pool (Neon serverless compatible). */
export function getPool(): pg.Pool {
  if (!globalForDb.conn) {
    let url = requireDatabaseUrl();
    url = url.replace(/[\?&]sslmode=[^&]+/g, '');
    globalForDb.conn = new Pool({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      max: 10,
      connectionTimeoutMillis: 20000, // Allow 20s for Neon compute endpoint wake up
      idleTimeoutMillis: 30000,
    });
  }
  return globalForDb.conn;
}

/** Run a parameterized query. */
export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<pg.QueryResult<T>> {
  try {
    return await getPool().query<T>(text, params);
  } catch (err) {
    // If pool connection dropped, reset pool reference
    if (globalForDb.conn) {
      try { await globalForDb.conn.end(); } catch { /* ignore */ }
      globalForDb.conn = undefined;
    }
    throw err;
  }
}
