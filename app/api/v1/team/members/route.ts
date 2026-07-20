import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken, adminTokenFromCookie } from '@/lib/team/auth';
import { createMemberWithKey } from '@/lib/team/stats';
import { query } from '@/lib/team/db';

export const dynamic = 'force-dynamic';

function requireAdmin(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    if (verifyAdminToken(token)) return true;
  }
  const cookieHeader = req.headers.get('cookie');
  const token = adminTokenFromCookie(cookieHeader);
  return verifyAdminToken(token);
}

export async function GET(req: NextRequest) {
  try {
    if (!requireAdmin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const teamId = req.nextUrl.searchParams.get('teamId');
    if (!teamId) return NextResponse.json({ error: 'teamId required' }, { status: 400 });
    const { rows: members } = await query(
      `SELECT m.id, m.display_name, m.role, m.created_at,
              (SELECT max(created_at) FROM ingest_events e WHERE e.member_id = m.id) AS last_sync_at
       FROM members m WHERE m.team_id = $1 ORDER BY m.display_name`,
      [teamId],
    );
    return NextResponse.json({ members });
  } catch (err) {
    console.error('[team/members GET error]', err);
    return NextResponse.json({ error: String((err as Error).message || err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!requireAdmin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
    }
    if (!body.teamId || !body.displayName) return NextResponse.json({ error: 'teamId and displayName required' }, { status: 400 });
    const { member, apiKey } = await createMemberWithKey(
      String(body.teamId),
      String(body.displayName),
      String(body.role ?? 'member'),
    );
    return NextResponse.json({ member, apiKey }, { status: 201 });
  } catch (err) {
    console.error('[team/members POST error]', err);
    return NextResponse.json({ error: String((err as Error).message || err) }, { status: 500 });
  }
}
