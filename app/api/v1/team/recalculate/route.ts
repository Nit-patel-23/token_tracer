import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken, adminTokenFromCookie } from '@/lib/team/auth';
import { recalculateTeamCosts } from '@/lib/team/stats';

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

export async function POST(req: NextRequest) {
  try {
    if (!requireAdmin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const { teamId } = body;
    if (!teamId) return NextResponse.json({ error: 'teamId required' }, { status: 400 });

    const result = await recalculateTeamCosts(teamId, true);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[team/recalculate POST error]', err);
    return NextResponse.json({ error: String((err as Error).message || err) }, { status: 500 });
  }
}
