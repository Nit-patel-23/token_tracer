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

let schemaChecked = false;
let schemaPromise: Promise<void> | null = null;

/**
 * Idempotently ensures core tables (team_members, model_pricing, users, etc.) exist.
 */
export async function ensureSchema(): Promise<void> {
  if (schemaChecked) return;
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const pool = getPool();
      try {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS teams (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
          );

          CREATE TABLE IF NOT EXISTS members (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
            display_name TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            sync_requested_at TIMESTAMPTZ
          );

          CREATE TABLE IF NOT EXISTS team_members (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
            member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
            role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE (team_id, member_id)
          );

          CREATE TABLE IF NOT EXISTS member_keys (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
            key_hash TEXT NOT NULL UNIQUE,
            label TEXT NOT NULL DEFAULT 'default',
            last_used_at TIMESTAMPTZ,
            revoked_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
          );

          CREATE TABLE IF NOT EXISTS users (
            id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            username      TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            display_name  TEXT NOT NULL,
            member_id     UUID REFERENCES members(id) ON DELETE SET NULL,
            team_id       UUID REFERENCES teams(id) ON DELETE SET NULL,
            role          TEXT NOT NULL DEFAULT 'user'
                            CHECK (role IN ('user', 'admin', 'superadmin')),
            active        BOOLEAN NOT NULL DEFAULT true,
            api_key       TEXT,
            last_login_at TIMESTAMPTZ,
            created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
          );

          CREATE TABLE IF NOT EXISTS model_pricing (
            id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            team_id               UUID REFERENCES teams(id) ON DELETE CASCADE,
            model_pattern         TEXT NOT NULL,
            cost_in_per_m         DOUBLE PRECISION NOT NULL DEFAULT 0,
            cost_out_per_m        DOUBLE PRECISION NOT NULL DEFAULT 0,
            cost_cache_read_per_m DOUBLE PRECISION NOT NULL DEFAULT 0,
            created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
          );

          -- Allow global pricing rules (team_id IS NULL)
          ALTER TABLE model_pricing ALTER COLUMN team_id DROP NOT NULL;
          CREATE UNIQUE INDEX IF NOT EXISTS idx_model_pricing_global_unique ON model_pricing (LOWER(model_pattern)) WHERE team_id IS NULL;
          CREATE UNIQUE INDEX IF NOT EXISTS idx_model_pricing_team_unique ON model_pricing (team_id, LOWER(model_pattern)) WHERE team_id IS NOT NULL;

          CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
          CREATE INDEX IF NOT EXISTS idx_team_members_member ON team_members(member_id);
          CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON users (LOWER(username));

          -- Backfill team_members from existing members
          INSERT INTO team_members (team_id, member_id, role, created_at)
          SELECT m.team_id, m.id, m.role, m.created_at
          FROM members m
          WHERE m.team_id IS NOT NULL
          ON CONFLICT (team_id, member_id) DO NOTHING;

          -- Add events JSONB column if not present
          ALTER TABLE sync_sessions ADD COLUMN IF NOT EXISTS events JSONB;
        `);
        schemaChecked = true;
      } catch (err) {
        console.warn('[db auto-schema notice]', (err as Error).message);
      } finally {
        schemaPromise = null;
      }
    })();
  }
  await schemaPromise;
}

/** Run a parameterized query. */
export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<pg.QueryResult<T>> {
  if (!schemaChecked) {
    await ensureSchema();
  }
  try {
    return await getPool().query<T>(text, params);
  } catch (err: unknown) {
    // If it's a 42P01 error (relation does not exist), ensure schema and retry once
    const pgErr = err as { code?: string };
    if (pgErr && pgErr.code === '42P01') {
      schemaChecked = false;
      await ensureSchema();
      return await getPool().query<T>(text, params);
    }
    // If pool connection dropped, reset pool reference
    if (globalForDb.conn) {
      try { await globalForDb.conn.end(); } catch { /* ignore */ }
      globalForDb.conn = undefined;
    }
    throw err;
  }
}
