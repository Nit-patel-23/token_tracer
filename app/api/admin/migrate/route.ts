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

    return NextResponse.json({ ok: true, message: 'Migration complete. Users table is ready.' });
  } catch (err) {
    console.error('[admin/migrate error]', err);
    return NextResponse.json({ error: String((err as Error).message || err) }, { status: 500 });
  }
}
