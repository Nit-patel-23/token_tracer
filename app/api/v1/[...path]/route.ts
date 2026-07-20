/**
 * Team API catch-all route handler.
 * Handles all /api/v1/* endpoints for the team dashboard.
 *
 * Routes:
 *   POST /api/v1/auth/login          — admin password → HMAC session token
 *   POST /api/v1/ingest              — member session data ingestion
 *   GET  /api/v1/team/stats          — team rollup statistics (admin only)
 *   GET  /api/v1/team/members        — list team members (admin only)
 *   POST /api/v1/team/members        — create member + API key (admin only)
 *   GET  /api/v1/teams               — list teams (admin only)
 *   POST /api/v1/teams               — create team (admin only)
 */
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  verifyAdminToken,
  verifyAdminPassword,
  issueAdminToken,
  adminTokenFromCookie,
  memberFromAuthHeader,
} from '@/lib/team/auth';
import { adminPassword } from '@/lib/team/env';
import { ingestSessions } from '@/lib/team/ingest';
import { buildTeamStats, createMemberWithKey } from '@/lib/team/stats';
import { query } from '@/lib/team/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ path: string[] }> };

// ── helpers ───────────────────────────────────────────────────────────────────

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function isVercel(req: NextRequest): boolean {
  return req.headers.get('x-forwarded-proto') === 'https' || process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
}

function requireAdmin(req: NextRequest): boolean {
  // Try Authorization header first
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    if (verifyAdminToken(token)) return true;
  }
  // Fall back to cookie
  const cookieHeader = req.headers.get('cookie');
  const token = adminTokenFromCookie(cookieHeader);
  return verifyAdminToken(token);
}

// ── dispatch ─────────────────────────────────────────────────────────────────

async function dispatch(req: NextRequest, pathSegments: string[]): Promise<NextResponse> {
  const pathname = `/api/v1/${pathSegments.join('/')}`;
  const url = req.nextUrl;

  // POST /api/v1/auth/login
  if (req.method === 'POST' && pathname === '/api/v1/auth/login') {
    if (!adminPassword()) {
      return json({ error: 'ADMIN_PASSWORD is not configured on the server' }, 503);
    }
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json({ error: 'invalid JSON' }, 400);
    }
    if (!verifyAdminPassword(String(body.password ?? ''))) {
      return json({ error: 'invalid credentials' }, 401);
    }
    const token = issueAdminToken();
    const secure = isVercel(req);
    const cookieValue = `team_admin=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secure ? '; Secure' : ''}`;
    const res = json({ ok: true, token });
    res.headers.set('Set-Cookie', cookieValue);
    return res;
  }

  // POST /api/v1/ingest
  if (req.method === 'POST' && pathname === '/api/v1/ingest') {
    const member = await memberFromAuthHeader(req.headers.get('authorization'));
    if (!member) return json({ error: 'invalid API key' }, 401);
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json({ error: 'invalid JSON' }, 400);
    }
    const sessions = (body.sessions as unknown[]) ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await ingestSessions(member, sessions as any);
    return json(result);
  }

  // GET /api/v1/team/stats
  if (req.method === 'GET' && pathname === '/api/v1/team/stats') {
    if (!requireAdmin(req)) return json({ error: 'unauthorized' }, 401);
    const teamId = url.searchParams.get('teamId');
    if (!teamId) return json({ error: 'teamId required' }, 400);
    const stats = await buildTeamStats(teamId, {
      from: url.searchParams.get('from'),
      to: url.searchParams.get('to'),
    });
    return json(stats);
  }

  // GET /api/v1/team/members
  if (req.method === 'GET' && pathname === '/api/v1/team/members') {
    if (!requireAdmin(req)) return json({ error: 'unauthorized' }, 401);
    const teamId = url.searchParams.get('teamId');
    if (!teamId) return json({ error: 'teamId required' }, 400);
    const { rows: members } = await query(
      `SELECT m.id, m.display_name, m.role, m.created_at,
              (SELECT max(created_at) FROM ingest_events e WHERE e.member_id = m.id) AS last_sync_at
       FROM members m WHERE m.team_id = $1 ORDER BY m.display_name`,
      [teamId],
    );
    return json({ members });
  }

  // POST /api/v1/team/members
  if (req.method === 'POST' && pathname === '/api/v1/team/members') {
    if (!requireAdmin(req)) return json({ error: 'unauthorized' }, 401);
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json({ error: 'invalid JSON' }, 400);
    }
    if (!body.teamId || !body.displayName) return json({ error: 'teamId and displayName required' }, 400);
    const { member, apiKey } = await createMemberWithKey(
      String(body.teamId),
      String(body.displayName),
      String(body.role ?? 'member'),
    );
    return json({ member, apiKey }, 201);
  }

  // GET /api/v1/teams
  if (req.method === 'GET' && pathname === '/api/v1/teams') {
    if (!requireAdmin(req)) return json({ error: 'unauthorized' }, 401);
    const { rows } = await query('SELECT id, name, created_at FROM teams ORDER BY created_at DESC');
    return json({ teams: rows });
  }

  // POST /api/v1/teams
  if (req.method === 'POST' && pathname === '/api/v1/teams') {
    if (!requireAdmin(req)) return json({ error: 'unauthorized' }, 401);
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json({ error: 'invalid JSON' }, 400);
    }
    if (!body.name) return json({ error: 'name required' }, 400);
    const { rows } = await query(
      'INSERT INTO teams (name) VALUES ($1) RETURNING id, name, created_at',
      [body.name],
    );
    return json({ team: rows[0] }, 201);
  }

  return json({ error: 'not found' }, 404);
}

// ── Next.js route exports ────────────────────────────────────────────────────

async function handler(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const params = await ctx.params;
  const pathSegments = params.path ?? [];
  try {
    return await dispatch(req, pathSegments);
  } catch (err) {
    console.error('[team-api]', err);
    return json({ error: String((err as Error).message || err) }, 500);
  }
}

export { handler as GET, handler as POST, handler as PUT, handler as DELETE, handler as PATCH };
