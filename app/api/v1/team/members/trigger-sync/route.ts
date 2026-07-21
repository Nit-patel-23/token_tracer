import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken, adminTokenFromCookie, memberFromAuthHeader } from '@/lib/team/auth';
import { query } from '@/lib/team/db';

export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

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

/** Admin triggers a sync signal for one or all team members. */
export async function POST(req: NextRequest) {
  try {
    if (!requireAdmin(req)) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: corsHeaders });
    }

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'invalid JSON' }, { status: 400, headers: corsHeaders });
    }

    const teamId = String(body.teamId || '');
    const memberId = String(body.memberId || 'all');

    if (!teamId) {
      return NextResponse.json({ error: 'teamId required' }, { status: 400, headers: corsHeaders });
    }

    if (memberId === 'all') {
      await query(
        'UPDATE members SET sync_requested_at = now() WHERE team_id = $1',
        [teamId],
      );
    } else {
      await query(
        'UPDATE members SET sync_requested_at = now() WHERE team_id = $1 AND id = $2',
        [teamId, memberId],
      );
    }

    return NextResponse.json(
      { success: true, message: `Sync signal broadcasted for ${memberId === 'all' ? 'all members' : memberId}` },
      { headers: corsHeaders },
    );
  } catch (err) {
    console.error('[trigger-sync POST error]', err);
    return NextResponse.json(
      { error: String((err as Error).message || err) },
      { status: 500, headers: corsHeaders },
    );
  }
}

/** Client daemon checks if a sync request is pending for its API key. */
export async function GET(req: NextRequest) {
  try {
    const member = await memberFromAuthHeader(req.headers.get('authorization'));
    if (!member) {
      return NextResponse.json({ error: 'invalid API key' }, { status: 401, headers: corsHeaders });
    }

    const { rows } = await query(
      'SELECT sync_requested_at FROM members WHERE id = $1',
      [member.member_id],
    );

    const syncRequestedAt = rows[0]?.sync_requested_at || null;

    return NextResponse.json(
      { syncRequested: Boolean(syncRequestedAt), syncRequestedAt },
      { headers: corsHeaders },
    );
  } catch (err) {
    console.error('[trigger-sync GET error]', err);
    return NextResponse.json(
      { error: String((err as Error).message || err) },
      { status: 500, headers: corsHeaders },
    );
  }
}
