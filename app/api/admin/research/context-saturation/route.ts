import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/team/db';
import { buildResearchFilters, parseRangeDays, requireSuperadminApi } from '@/lib/team/researchQuery';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const forbidden = requireSuperadminApi(req);
  if (forbidden) return forbidden;

  const searchParams = req.nextUrl.searchParams;
  const days = parseRangeDays(searchParams.get('range'));

  const { whereClause, params } = buildResearchFilters(
    searchParams,
    "ss.started_at >= NOW() - $1::int * INTERVAL '1 day'",
    [days],
    [
      { param: 'model', column: 'st.model' },
      { param: 'tool', column: 'st.tool' },
    ],
  );

  try {
    const { rows } = await query(`
      SELECT 
        st.model,
        LEAST(9, FLOOR((st.cumulative_input_tokens::float / COALESCE(mcl.max_context_tokens, 200000)) * 10)::int) AS "fillBucket",
        COALESCE(COUNT(*) FILTER (WHERE st.tool_error_flag)::float / NULLIF(COUNT(*), 0), 0) AS "toolErrorRate",
        COALESCE(SUM(st.tool_call_valid_count)::float / NULLIF(SUM(st.tool_call_count), 0), 0) AS "validToolCallRate",
        COUNT(*)::int AS "sampleSize"
      FROM session_turns st
      JOIN sync_sessions ss ON ss.session_id = st.session_id
                           AND st.org_id = ss.team_id::text
                           AND st.user_id = ss.member_id::text
                           AND st.tool = ss.source
      LEFT JOIN model_context_limits mcl ON mcl.model = st.model
      WHERE st.turn_role = 'assistant'
        AND st.cumulative_input_tokens > 0
        AND ${whereClause}
      GROUP BY st.model, "fillBucket"
      ORDER BY st.model, "fillBucket"
    `, params);

    // Compute inflection points per model
    const inflectionPoints: Record<string, number | null> = {};
    const models = [...new Set(rows.map(r => r.model))];

    for (const m of models) {
      const modelRows = rows.filter(r => r.model === m).sort((a, b) => a.fillBucket - b.fillBucket);
      
      // Calculate baseline error rate in 0-20% fill range (buckets 0 and 1)
      const baselineRows = modelRows.filter(r => r.fillBucket <= 1);
      const baselineSum = baselineRows.reduce((sum, r) => sum + r.toolErrorRate, 0);
      const baselineError = baselineRows.length ? (baselineSum / baselineRows.length) : 0;

      let inflectionBucket: number | null = null;
      for (const r of modelRows) {
        if (r.fillBucket > 1 && baselineError > 0 && r.toolErrorRate > 1.5 * baselineError) {
          inflectionBucket = r.fillBucket;
          break;
        }
      }
      inflectionPoints[m] = inflectionBucket;
    }

    // Turn-level scatter (fill % vs error flag), sampled for a drill-down
    // view — the bucket histogram above hides individual near-limit turns.
    const { rows: scatter } = await query(`
      SELECT model, "fillPct", "toolErrorFlag", "sessionId", "turnIndex"
      FROM (
        SELECT
          st.model,
          (st.cumulative_input_tokens::float / COALESCE(mcl.max_context_tokens, 200000)) AS "fillPct",
          st.tool_error_flag AS "toolErrorFlag",
          st.session_id AS "sessionId",
          st.turn_index AS "turnIndex",
          ROW_NUMBER() OVER (PARTITION BY st.model ORDER BY RANDOM()) AS rn
        FROM session_turns st
        JOIN sync_sessions ss ON ss.session_id = st.session_id
                             AND st.org_id = ss.team_id::text
                             AND st.user_id = ss.member_id::text
                             AND st.tool = ss.source
        LEFT JOIN model_context_limits mcl ON mcl.model = st.model
        WHERE st.turn_role = 'assistant'
          AND st.cumulative_input_tokens > 0
          AND ${whereClause}
      ) sampled
      WHERE rn <= 500
      ORDER BY model, "fillPct"
    `, params);

    return NextResponse.json({ rows, inflectionPoints, scatter });
  } catch (err: any) {
    console.error('[research-saturation-error]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
