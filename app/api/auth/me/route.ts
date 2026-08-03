/**
 * GET  /api/auth/me   → returns current session info (200) or 401
 * POST /api/auth/logout → clears session cookie
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookie, clearSessionCookie } from '@/lib/auth';
import { query } from '@/lib/team/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = getSessionFromCookie(req.headers.get('cookie'));
  if (!session) {
    return NextResponse.json({ error: 'not authenticated' }, { status: 401 });
  }

  // For regular users, also fetch their raw API key (stored in member_keys).
  // We only expose the key label + creation date, not the hash.
  let apiKey: string | null = null;
  let installCommandMac: string | null = null;
  let installCommandWin: string | null = null;

  let sessionCount = 0;

  if (session.role === 'user') {
    const { rows: userRows } = await query(
      `SELECT u.api_key, u.member_id FROM users u WHERE u.id = $1`,
      [session.userId],
    );
    if (userRows[0]) {
      apiKey = userRows[0].api_key ?? null;
      const memberId = userRows[0].member_id;
      if (memberId) {
        const { rows: countRows } = await query(
          `SELECT count(*)::int AS count FROM sync_sessions WHERE member_id = $1`,
          [memberId],
        );
        sessionCount = countRows[0]?.count || 0;
      }
    }
  }

  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'https://token-tracer-three.vercel.app';
  if (apiKey) {
    installCommandMac = `curl -fsSL ${serverUrl}/install.sh | bash -s -- --key ${apiKey}`;
    installCommandWin = `$ApiKey="${apiKey}"; iex (irm ${serverUrl}/install.ps1)`;
  }

  return NextResponse.json({
    userId: session.userId,
    username: session.username,
    displayName: session.displayName,
    role: session.role,
    memberId: session.memberId,
    teamId: session.teamId,
    apiKey,
    installCommandMac,
    installCommandWin,
    sessionCount,
  });
}

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  res.headers.set('Set-Cookie', clearSessionCookie());
  return res;
}
