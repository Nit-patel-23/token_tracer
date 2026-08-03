import { NextRequest, NextResponse } from 'next/server';
import { getAuthorizedTeamId } from '@/lib/auth';
import { createMemberWithKey, updateMember, deleteMember } from '@/lib/team/stats';
import { query } from '@/lib/team/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const rawTeamId = req.nextUrl.searchParams.get('teamId');
    const teamId = getAuthorizedTeamId(req, rawTeamId);
    if (!teamId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const { rows: members } = await query(
      `SELECT m.id, m.display_name, m.role, m.created_at, m.sync_requested_at,
              GREATEST(
                (SELECT max(created_at) FROM ingest_events e WHERE e.member_id = m.id),
                (SELECT max(COALESCE(s.ended_at, s.started_at, s.synced_at)) FROM sync_sessions s WHERE s.member_id = m.id),
                (SELECT max(k.last_used_at) FROM member_keys k WHERE k.member_id = m.id)
              ) AS last_sync_at,
              (SELECT count(*) FROM sync_sessions s WHERE s.member_id = m.id)::int AS session_count,
              (SELECT coalesce(sum(s.tokens_in + s.tokens_out), 0) FROM sync_sessions s WHERE s.member_id = m.id)::bigint AS total_tokens,
              (SELECT coalesce(sum(s.api_cost), 0) FROM sync_sessions s WHERE s.member_id = m.id)::float AS total_cost
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
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
    }
    const rawTeamId = body.teamId ? String(body.teamId) : null;
    const teamId = getAuthorizedTeamId(req, rawTeamId);
    if (!teamId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    if (!body.displayName) return NextResponse.json({ error: 'displayName required' }, { status: 400 });

    const { member, apiKey } = await createMemberWithKey(
      teamId,
      String(body.displayName),
      String(body.role ?? 'member'),
    );
    return NextResponse.json({ member, apiKey }, { status: 201 });
  } catch (err) {
    console.error('[team/members POST error]', err);
    return NextResponse.json({ error: String((err as Error).message || err) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
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
    if (!body.id || !body.displayName) {
      return NextResponse.json({ error: 'id and displayName required' }, { status: 400 });
    }

    const member = await updateMember(
      String(body.id),
      teamId,
      String(body.displayName),
      String(body.role ?? 'member'),
    );
    if (!member) return NextResponse.json({ error: 'member not found' }, { status: 404 });
    return NextResponse.json({ member });
  } catch (err) {
    console.error('[team/members PUT error]', err);
    return NextResponse.json({ error: String((err as Error).message || err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    const rawTeamId = req.nextUrl.searchParams.get('teamId');
    const teamId = getAuthorizedTeamId(req, rawTeamId);
    if (!teamId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const res = await deleteMember(id, teamId);
    return NextResponse.json(res);
  } catch (err) {
    console.error('[team/members DELETE error]', err);
    return NextResponse.json({ error: String((err as Error).message || err) }, { status: 500 });
  }
}
