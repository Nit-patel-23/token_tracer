import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken, adminTokenFromCookie } from '@/lib/team/auth';
import { query } from '@/lib/team/db';
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

export async function GET(req: NextRequest) {
  try {
    if (!requireAdmin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const teamId = req.nextUrl.searchParams.get('teamId');
    if (!teamId) return NextResponse.json({ error: 'teamId required' }, { status: 400 });

    const { rows: pricing } = await query(
      'SELECT id, model_pattern, cost_in_per_m, cost_out_per_m, cost_cache_read_per_m, created_at FROM model_pricing WHERE team_id = $1 ORDER BY model_pattern',
      [teamId],
    );
    return NextResponse.json({ pricing });
  } catch (err) {
    console.error('[team/pricing GET error]', err);
    return NextResponse.json({ error: String((err as Error).message || err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!requireAdmin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const { teamId, modelPattern, costInPerM, costOutPerM, costCacheReadPerM } = body;
    if (!teamId || !modelPattern) {
      return NextResponse.json({ error: 'teamId and modelPattern required' }, { status: 400 });
    }

    const { rows } = await query(
      `INSERT INTO model_pricing (team_id, model_pattern, cost_in_per_m, cost_out_per_m, cost_cache_read_per_m)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (team_id, model_pattern) DO UPDATE SET
         cost_in_per_m = EXCLUDED.cost_in_per_m,
         cost_out_per_m = EXCLUDED.cost_out_per_m,
         cost_cache_read_per_m = EXCLUDED.cost_cache_read_per_m
       RETURNING id, model_pattern, cost_in_per_m, cost_out_per_m, cost_cache_read_per_m`,
      [
        teamId,
        String(modelPattern).trim().toLowerCase(),
        Number(costInPerM || 0),
        Number(costOutPerM || 0),
        Number(costCacheReadPerM || 0),
      ],
    );

    // Automatically recalculate costs for all synced sessions of this team
    const recalc = await recalculateTeamCosts(teamId);

    return NextResponse.json({ item: rows[0], recalc }, { status: 201 });
  } catch (err) {
    console.error('[team/pricing POST error]', err);
    return NextResponse.json({ error: String((err as Error).message || err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!requireAdmin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const id = req.nextUrl.searchParams.get('id');
    const teamId = req.nextUrl.searchParams.get('teamId');
    if (!id || !teamId) return NextResponse.json({ error: 'id and teamId required' }, { status: 400 });

    const { rowCount } = await query('DELETE FROM model_pricing WHERE id = $1 AND team_id = $2', [id, teamId]);
    if (rowCount && rowCount > 0) {
      await recalculateTeamCosts(teamId);
    }
    return NextResponse.json({ ok: true, deleted: (rowCount || 0) > 0 });
  } catch (err) {
    console.error('[team/pricing DELETE error]', err);
    return NextResponse.json({ error: String((err as Error).message || err) }, { status: 500 });
  }
}

