/**
 * CRUD for users table — superadmin only.
 *
 * GET    /api/admin/users          → list all users with linked member info
 * POST   /api/admin/users          → create a user (hashes password, generates API key if memberId given)
 * PUT    /api/admin/users          → update display name, role, active, memberId
 * DELETE /api/admin/users?id=uuid  → hard delete a user
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookie, hashPassword } from '@/lib/auth';
import { generateApiKey, hashApiKey } from '@/lib/team/auth';
import { query } from '@/lib/team/db';

export const dynamic = 'force-dynamic';

function requireSuperadmin(req: NextRequest): boolean {
  const session = getSessionFromCookie(req.headers.get('cookie'));
  return session?.role === 'superadmin';
}

export async function GET(req: NextRequest) {
  if (!requireSuperadmin(req)) return NextResponse.json({ error: 'superadmin access required' }, { status: 403 });

  try {
    const { rows } = await query(`
      SELECT u.id, u.username, u.display_name, u.role, u.active,
             u.member_id, u.team_id, u.last_login_at, u.created_at, u.updated_at,
             m.display_name AS member_name,
             t.name AS team_name,
             (u.api_key IS NOT NULL) AS has_api_key,
             (SELECT count(*)::int FROM sync_sessions s WHERE s.member_id = u.member_id) AS session_count,
             (SELECT max(COALESCE(s.ended_at, s.started_at)) FROM sync_sessions s WHERE s.member_id = u.member_id) AS last_session_at
      FROM users u
      LEFT JOIN members m ON m.id = u.member_id
      LEFT JOIN teams t ON t.id = u.team_id
      ORDER BY u.created_at ASC
    `);

    // Also fetch members that have no user account (to help with linking)
    const { rows: unlinkedMembers } = await query(`
      SELECT m.id, m.display_name, m.team_id, t.name AS team_name
      FROM members m
      LEFT JOIN teams t ON t.id = m.team_id
      WHERE m.id NOT IN (SELECT member_id FROM users WHERE member_id IS NOT NULL)
      ORDER BY m.display_name
    `);

    // Also fetch all teams
    const { rows: teams } = await query(`
      SELECT id, name FROM teams ORDER BY name
    `);

    return NextResponse.json({ users: rows, unlinkedMembers, teams });
  } catch (err: any) {
    const errMsg = String(err?.message || err);
    if (errMsg.includes('relation "users" does not exist')) {
      return NextResponse.json({ users: [], unlinkedMembers: [], teams: [], needsMigration: true });
    }
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!requireSuperadmin(req)) return NextResponse.json({ error: 'superadmin access required' }, { status: 403 });

  try {
    const body = await req.json();
    const username = String(body.username || '').trim().toLowerCase();
    const password = String(body.password || '');
    const displayName = String(body.displayName || body.display_name || '').trim();
    const memberId = body.memberId || body.member_id || null;
    const teamId = body.teamId || body.team_id || null;
    const role = String(body.role || 'user');
    const newTeamName = String(body.newTeamName || '').trim();

    if (!username || !password || !displayName) {
      return NextResponse.json({ error: 'username, password, and displayName are required' }, { status: 400 });
    }
    if (!['user', 'admin', 'superadmin'].includes(role)) {
      return NextResponse.json({ error: 'invalid role' }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);

    let finalMemberId = memberId;
    let rawApiKey: string | null = null;
    let apiKeyHash: string | null = null;

    if (role === 'user' && memberId === 'new') {
      let teamRes = await query("SELECT id FROM teams WHERE name = 'Independent' LIMIT 1");
      let independentTeamId = teamRes.rows[0]?.id;
      if (!independentTeamId) {
        const newTeamRes = await query("INSERT INTO teams (name) VALUES ('Independent') RETURNING id");
        independentTeamId = newTeamRes.rows[0].id;
      }

      const memberRes = await query(
        "INSERT INTO members (team_id, display_name, role) VALUES ($1, $2, 'member') RETURNING id",
        [independentTeamId, displayName]
      );
      finalMemberId = memberRes.rows[0].id;
    }

    if (finalMemberId && finalMemberId !== 'new') {
      rawApiKey = generateApiKey();
      apiKeyHash = hashApiKey(rawApiKey);
      // Upsert a member_key row for this member
      await query(
        `INSERT INTO member_keys (member_id, key_hash, label)
         VALUES ($1, $2, 'default')
         ON CONFLICT (key_hash) DO NOTHING`,
        [finalMemberId, apiKeyHash],
      );
    }

    let finalTeamId = teamId;
    if (role === 'admin' && newTeamName) {
      const { rows: teamRows } = await query(
        'INSERT INTO teams (name) VALUES ($1) RETURNING id',
        [newTeamName]
      );
      finalTeamId = teamRows[0].id;
    } else if (role !== 'admin') {
      finalTeamId = null;
    }

    const { rows } = await query(`
      INSERT INTO users (username, password_hash, display_name, member_id, team_id, role, api_key)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, username, display_name, role, member_id, team_id, active, created_at
    `, [username, passwordHash, displayName, finalMemberId, finalTeamId, role, rawApiKey]);

    return NextResponse.json({ user: rows[0], apiKey: rawApiKey }, { status: 201 });
  } catch (err: any) {
    if (err?.code === '23505') {
      return NextResponse.json({ error: 'Username already exists' }, { status: 409 });
    }
    console.error('[admin/users POST error]', err);
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  if (!requireSuperadmin(req)) return NextResponse.json({ error: 'superadmin access required' }, { status: 403 });

  try {
    const body = await req.json();
    const { id, displayName, role, active, memberId, teamId } = body;
    const newTeamName = String(body.newTeamName || '').trim();
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    let finalTeamId = teamId;
    if (role === 'admin' && newTeamName) {
      const { rows: teamRows } = await query(
        'INSERT INTO teams (name) VALUES ($1) RETURNING id',
        [newTeamName]
      );
      finalTeamId = teamRows[0].id;
    } else if (role !== 'admin' && role !== undefined) {
      // If changing role away from admin, remove team association
      finalTeamId = null;
    }

    let finalMemberId = memberId;
    if (role === 'user' && memberId === 'new') {
      let teamRes = await query("SELECT id FROM teams WHERE name = 'Independent' LIMIT 1");
      let independentTeamId = teamRes.rows[0]?.id;
      if (!independentTeamId) {
        const newTeamRes = await query("INSERT INTO teams (name) VALUES ('Independent') RETURNING id");
        independentTeamId = newTeamRes.rows[0].id;
      }

      const memberRes = await query(
        "INSERT INTO members (team_id, display_name, role) VALUES ($1, $2, 'member') RETURNING id",
        [independentTeamId, displayName || 'Unnamed Member']
      );
      finalMemberId = memberRes.rows[0].id;
    }

    const { rows } = await query(`
      UPDATE users SET
        display_name = COALESCE($2, display_name),
        role         = COALESCE($3, role),
        active       = COALESCE($4, active),
        member_id    = $5,
        team_id      = COALESCE($6, team_id),
        updated_at   = now()
      WHERE id = $1
      RETURNING id, username, display_name, role, active, member_id, team_id, updated_at
    `, [id, displayName ?? null, role ?? null, active ?? null, finalMemberId ?? null, finalTeamId ?? null]);

    if (!rows[0]) return NextResponse.json({ error: 'user not found' }, { status: 404 });
    return NextResponse.json({ user: rows[0] });
  } catch (err) {
    return NextResponse.json({ error: String((err as Error).message || err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!requireSuperadmin(req)) return NextResponse.json({ error: 'superadmin access required' }, { status: 403 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  try {
    const { rowCount } = await query('DELETE FROM users WHERE id = $1', [id]);
    return NextResponse.json({ ok: true, deleted: (rowCount || 0) > 0 });
  } catch (err) {
    return NextResponse.json({ error: String((err as Error).message || err) }, { status: 500 });
  }
}
