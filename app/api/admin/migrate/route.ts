/**
 * POST /api/admin/migrate
 * Superadmin-only. Idempotently creates the users table and default superadmin user.
 * Run this once after deploying.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookie, hashPassword } from '@/lib/auth';
import { query } from '@/lib/team/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = getSessionFromCookie(req.headers.get('cookie'));
  if (!session || session.role !== 'superadmin') {
    return NextResponse.json({ error: 'superadmin access required' }, { status: 403 });
  }

  try {
    // Create users table
    await query(`
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
      )
    `);

    await query(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_users_member ON users(member_id)`);

    // Create model_pricing table (custom per-team cost overrides)
    await query(`
      CREATE TABLE IF NOT EXISTS model_pricing (
        id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        team_id               UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        model_pattern         TEXT NOT NULL,
        cost_in_per_m         DOUBLE PRECISION NOT NULL DEFAULT 0,
        cost_out_per_m        DOUBLE PRECISION NOT NULL DEFAULT 0,
        cost_cache_read_per_m DOUBLE PRECISION NOT NULL DEFAULT 0,
        created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (team_id, model_pattern)
      )
    `);

    // Create team_members junction table for multi-team support
    await query(`
      CREATE TABLE IF NOT EXISTS team_members (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        team_id     UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        member_id   UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        role        TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (team_id, member_id)
      )
    `);

    await query(`CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_team_members_member ON team_members(member_id)`);

    // Backfill team_members from existing members.team_id
    await query(`
      INSERT INTO team_members (team_id, member_id, role, created_at)
      SELECT m.team_id, m.id, m.role, m.created_at
      FROM members m
      WHERE m.team_id IS NOT NULL
      ON CONFLICT (team_id, member_id) DO NOTHING
    `).catch((err) => console.warn('team_members backfill note:', err.message));

    // Ensure case-insensitive unique index on users.username
    await query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON users (LOWER(username))`).catch((err) => console.warn('idx_users_username_lower note:', err.message));

    // Ensure sync_requested_at exists on members
    await query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS sync_requested_at TIMESTAMPTZ`).catch(() => {});

    // Alter tables to allow nullable team_id for independent personal dashboards
    await query(`ALTER TABLE members ALTER COLUMN team_id DROP NOT NULL`).catch(() => {});
    await query(`ALTER TABLE sync_sessions ALTER COLUMN team_id DROP NOT NULL`).catch(() => {});

    return NextResponse.json({ ok: true, message: 'Migration complete. Users table and multi-team memberships are ready.' });
  } catch (err) {
    console.error('[admin/migrate error]', err);
    return NextResponse.json({ error: String((err as Error).message || err) }, { status: 500 });
  }
}
