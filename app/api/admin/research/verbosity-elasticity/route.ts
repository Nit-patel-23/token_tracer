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
      { param: 'intent', column: 'st.intent_category' },
    ],
  );

  try {
    // 1. Calculate regression stats per model per intent category
    const { rows: stats } = await query(`
      SELECT 
        st.model,
        COALESCE(ust.intent_category, 'other') AS "intentCategory",
        REGR_SLOPE(st.output_tokens, st.input_tokens)::float AS slope,
        REGR_INTERCEPT(st.output_tokens, st.input_tokens)::float AS intercept,
        COALESCE(REGR_R2(st.output_tokens, st.input_tokens)::float, 0) AS r2,
        COUNT(*)::int AS "sampleSize"
      FROM session_turns st
      JOIN sync_sessions ss ON ss.session_id = st.session_id
                           AND st.org_id = ss.team_id::text
                           AND st.user_id = ss.member_id::text
                           AND st.tool = ss.source
      LEFT JOIN session_turns ust ON ust.session_id = st.session_id
                                 AND ust.org_id = st.org_id
                                 AND ust.user_id = st.user_id
                                 AND ust.tool = st.tool
                                 AND ust.turn_index = st.turn_index
                                 AND ust.turn_role = 'user'
      WHERE st.turn_role = 'assistant'
        AND st.input_tokens > 0
        AND st.output_tokens > 0
        AND ${whereClause}
      GROUP BY st.model, "intentCategory"
      HAVING COUNT(*) >= 5
    `, params);

    // 2. Fetch raw scatter points, capped at 500 per model/intent series
    const { rows: points } = await query(`
      WITH filtered_turns AS (
        SELECT 
          st.model,
          COALESCE(ust.intent_category, 'other') AS intent_category,
          st.input_tokens AS x,
          st.output_tokens AS y,
          st.files_touched,
          ROW_NUMBER() OVER (PARTITION BY st.model, COALESCE(ust.intent_category, 'other') ORDER BY RANDOM()) as rn
        FROM session_turns st
        JOIN sync_sessions ss ON ss.session_id = st.session_id
                             AND st.org_id = ss.team_id::text
                             AND st.user_id = ss.member_id::text
                             AND st.tool = ss.source
        LEFT JOIN session_turns ust ON ust.session_id = st.session_id
                                   AND ust.org_id = st.org_id
                                   AND ust.user_id = st.user_id
                                   AND ust.tool = st.tool
                                   AND ust.turn_index = st.turn_index
                                   AND ust.turn_role = 'user'
        WHERE st.turn_role = 'assistant'
          AND st.input_tokens > 0
          AND st.output_tokens > 0
          AND ${whereClause}
      )
      SELECT model, intent_category AS "intentCategory", x::int, y::int, files_touched AS "filesTouched"
      FROM filtered_turns
      WHERE rn <= 500
    `, params);

    return NextResponse.json({ stats, points });
  } catch (err: any) {
    console.error('[research-elasticity-error]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
