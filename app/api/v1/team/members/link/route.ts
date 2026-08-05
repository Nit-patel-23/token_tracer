import { NextRequest, NextResponse } from 'next/server';
import { getAuthorizedTeamId } from '@/lib/auth';
import { query } from '@/lib/team/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const rawTeamId = req.nextUrl.searchParams.get('teamId');
    const teamId = getAuthorizedTeamId(req, rawTeamId);
    if (!teamId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    // Find members that do not belong to the current team
    const { rows: members } = await query(
      `SELECT m.id, m.display_name, t.name AS team_name
       FROM members m
       LEFT JOIN teams t ON t.id = m.team_id
       WHERE m.team_id IS NULL OR m.team_id != $1
       ORDER BY m.display_name`,
      [teamId],
    );

    return NextResponse.json({ members });
  } catch (err) {
    console.error('[team/members/link GET error]', err);
    return NextResponse.json({ error: String((err as Error).message || err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
    }

    const rawTeamId = body.teamId ? String(body.teamId) : null;
    const teamId = getAuthorizedTeamId(req, rawTeamId);
    if (!teamId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const memberId = body.memberId ? String(body.memberId) : null;
    if (!memberId) return NextResponse.json({ error: 'memberId required' }, { status: 400 });

    // 1. Update the member's team_id
    await query('UPDATE members SET team_id = $1 WHERE id = $2', [teamId, memberId]);

    // 2. Update their existing sync sessions to belong to the new team
    await query('UPDATE sync_sessions SET team_id = $1 WHERE member_id = $2', [teamId, memberId]);

    // 3. Update their ingest events to belong to the new team
    await query('UPDATE ingest_events SET team_id = $1 WHERE member_id = $2', [teamId, memberId]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[team/members/link POST error]', err);
    return NextResponse.json({ error: String((err as Error).message || err) }, { status: 500 });
  }
}
