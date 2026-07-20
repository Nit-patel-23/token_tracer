import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken, adminTokenFromCookie } from '@/lib/team/auth';
import { buildTeamStats } from '@/lib/team/stats';

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
    const minTok = req.nextUrl.searchParams.get('minTokens');
    const maxTok = req.nextUrl.searchParams.get('maxTokens');

    const stats = await buildTeamStats(teamId, {
      from: req.nextUrl.searchParams.get('from'),
      to: req.nextUrl.searchParams.get('to'),
      memberId: req.nextUrl.searchParams.get('memberId'),
      source: req.nextUrl.searchParams.get('source'),
      minTokens: minTok ? Number(minTok) : null,
      maxTokens: maxTok ? Number(maxTok) : null,
    });
    return NextResponse.json(stats);
  } catch (err) {
    console.error('[team/stats GET error]', err);
    return NextResponse.json({ error: String((err as Error).message || err) }, { status: 500 });
  }
}
