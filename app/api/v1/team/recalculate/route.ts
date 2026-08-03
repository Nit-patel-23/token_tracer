import { NextRequest, NextResponse } from 'next/server';
import { getAuthorizedTeamId } from '@/lib/auth';
import { recalculateTeamCosts } from '@/lib/team/stats';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawTeamId = body.teamId ? String(body.teamId) : null;
    const teamId = getAuthorizedTeamId(req, rawTeamId);
    if (!teamId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const result = await recalculateTeamCosts(teamId, true);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[team/recalculate POST error]', err);
    return NextResponse.json({ error: String((err as Error).message || err) }, { status: 500 });
  }
}
