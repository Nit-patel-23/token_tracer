import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/team/db';
import { buildResearchFilters, parseRangeDays, requireSuperadminApi } from '@/lib/team/researchQuery';

export const dynamic = 'force-dynamic';

interface OutcomePoint {
  model: string;
  avgCost: number;
  successRate: number;
  sessionCount: number;
  isPareto?: boolean;
}

export async function GET(req: NextRequest) {
  const forbidden = requireSuperadminApi(req);
  if (forbidden) return forbidden;

  const searchParams = req.nextUrl.searchParams;
  const intentFilter = searchParams.get('intent');
  const days = parseRangeDays(searchParams.get('range'));

  const { whereClause, params } = buildResearchFilters(
    searchParams,
    "ss.started_at >= NOW() - $1::int * INTERVAL '1 day'",
    [days],
    [{ param: 'intent', column: 'so.intent_category' }],
  );

  try {
    const { rows } = await query(`
      SELECT 
        COALESCE(so.intent_category, 'other') AS "intentCategory",
        so.model,
        COALESCE(AVG(so.total_cost)::float, 0) AS "avgCost",
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
        [intentFilter]: responseData[intentFilter] || []
      });
    }

    return NextResponse.json(responseData);
  } catch (err: any) {
    console.error('[research-frontier-error]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
