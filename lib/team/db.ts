/**
 * Shared Postgres connection pool.
 * Uses the pg library. Compatible with Neon serverless Postgres.
 * Safe for serverless: creates one pool per cold start.
 */
import pg from 'pg';
import { requireDatabaseUrl } from './env';

const { Pool } = pg;
let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: requireDatabaseUrl(),
      ssl: { rejectUnauthorized: false },
      max: 5,
    });
  }
  return pool;
}

/** Run a parameterized query. */
export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<pg.QueryResult<T>> {
  return getPool().query<T>(text, params);
}
