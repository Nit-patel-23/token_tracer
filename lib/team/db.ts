import pg from 'pg';
import { requireDatabaseUrl } from './env';

const { Pool } = pg;

const globalForDb = globalThis as unknown as {
  conn: pg.Pool | undefined;
};

function sslRejectUnauthorized(connectionString: string): boolean {
  // Explicit override wins.
  if (process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'true') return true;
  if (process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'false') return false;
  // Neon poolers commonly need relaxed verification unless a custom CA is configured.
  if (/neon\.tech/i.test(connectionString)) return false;
  return true;
}

/** Shared Postgres pool (Neon serverless compatible). */
export function getPool(): pg.Pool {
  if (!globalForDb.conn) {
    let url = requireDatabaseUrl();
    url = url.replace(/[\?&]sslmode=[^&]+/g, '');
    globalForDb.conn = new Pool({
      connectionString: url,
      ssl: { rejectUnauthorized: sslRejectUnauthorized(url) },
      max: 10,
      connectionTimeoutMillis: 20000,
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
      try {
        await globalForDb.conn.end();
      } catch {
        /* ignore */
      }
      globalForDb.conn = undefined;
    }
    throw err;
  }
}
