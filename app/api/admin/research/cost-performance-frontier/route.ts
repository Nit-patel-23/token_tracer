import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionFromCookie } from '@/lib/auth';
import { query } from '@/lib/team/db';

export const dynamic = 'force-dynamic';

function parseDays(range: string | null): number {
  if (!range) return 30;
  const m = range.match(/^(\d+)d$/);
  return m ? Math.min(Math.max(1, Number(m[1])), 90) : 30;
}

interface OutcomePoint {
  model: string;
  avgCost: number;
  successRate: number;
  sessionCount: number;
  isPareto?: boolean;
}

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const session = getSessionFromCookie(cookieStore.toString());
  if (!session || session.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const searchParams = req.nextUrl.searchParams;
  const days = parseDays(searchParams.get('range'));
  const intentFilter = searchParams.get('intent');

  // Build filter conditions
  const conditions = ["ss.started_at >= NOW() - $1::int * INTERVAL '1 day'"];
  const params: any[] = [days];
  let paramIdx = 2;

  if (intentFilter) {
    conditions.push(`so.intent_category = $${paramIdx}`);
    params.push(intentFilter);
    paramIdx++;
  }

  const whereClause = conditions.join(' AND ');

  try {
    const { rows } = await query(`
      SELECT 
        COALESCE(so.intent_category, 'other') AS "intentCategory",
        so.model,
        AVG(so.total_cost)::float AS "avgCost",
        COALESCE(COUNT(*) FILTER (WHERE so.success)::float / NULLIF(COUNT(*), 0), 0) AS "successRate",
        COUNT(*)::int AS "sessionCount"
      FROM session_outcomes so
      JOIN sync_sessions ss ON ss.session_id = so.session_id
      WHERE ${whereClause}
      GROUP BY "intentCategory", so.model
      HAVING COUNT(*) >= 2
    `, params);

    // Group by intentCategory and calculate Pareto frontiers
    const grouped: Record<string, OutcomePoint[]> = {};
    for (const r of rows) {
      if (!grouped[r.intentCategory]) {
        grouped[r.intentCategory] = [];
      }
      grouped[r.intentCategory].push({
        model: r.model,
        avgCost: r.avgCost,
        successRate: r.successRate,
        sessionCount: r.sessionCount
      });
    }

    const responseData: Record<string, OutcomePoint[]> = {};

    for (const category in grouped) {
      const points = grouped[category];
      
      // Pareto dominance calculation:
      // Point A is dominated by Point B if:
      // B.avgCost <= A.avgCost AND B.successRate >= A.successRate
      // and at least one is strict.
      points.forEach(p1 => {
        p1.isPareto = !points.some(p2 => {
          if (p1 === p2) return false;
          return p2.avgCost <= p1.avgCost && 
                 p2.successRate >= p1.successRate && 
                 (p2.avgCost < p1.avgCost || p2.successRate > p1.successRate);
        });
      });

      responseData[category] = points;
    }

    if (intentFilter) {
      return NextResponse.json({
        intentCategory: intentFilter,
        points: responseData[intentFilter] || []
      });
    }

    return NextResponse.json(responseData);
  } catch (err: any) {
    console.error('[research-frontier-error]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
