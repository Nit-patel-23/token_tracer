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
      { param: 'org', column: 'so.org_id' },
      { param: 'tool', column: 'so.tool' },
      { param: 'model', column: 'so.model' },
    ],
  );

  try {
    const { rows } = await query(`
      WITH ranked_sessions AS (
        SELECT 
          so.session_id,
          so.org_id,
          so.tool,
          so.had_rework,
          so.had_revert,
          so.total_input_tokens,
          so.total_output_tokens,
          so.lines_changed,
          NTILE(3) OVER (ORDER BY so.complexity_score) AS complexity_bucket
        FROM session_outcomes so
        JOIN sync_sessions ss ON ss.session_id = so.session_id
                             AND ss.team_id::text = so.org_id
                             AND ss.source = so.tool
        WHERE ${whereClause}
      )
      SELECT 
        (CASE 
           WHEN (CASE WHEN st.has_code_block THEN 1 ELSE 0 END +
                 CASE WHEN st.has_file_path THEN 1 ELSE 0 END +
                 CASE WHEN st.has_traceback THEN 1 ELSE 0 END) = 0 THEN 'vague'
           WHEN (CASE WHEN st.has_code_block THEN 1 ELSE 0 END +
                 CASE WHEN st.has_file_path THEN 1 ELSE 0 END +
                 CASE WHEN st.has_traceback THEN 1 ELSE 0 END) = 1 THEN 'partial'
           ELSE 'specific'
         END) AS tier,
        (CASE 
           WHEN r.complexity_bucket = 1 THEN 'Low Complexity'
           WHEN r.complexity_bucket = 2 THEN 'Medium Complexity'
           ELSE 'High Complexity'
         END) AS "complexityBucket",
        COUNT(DISTINCT r.session_id)::int AS "sampleSize",
        COALESCE(SUM(r.total_input_tokens + r.total_output_tokens)::float / NULLIF(SUM(r.lines_changed), 0), 0) AS "avgTokensPerLine",
        COALESCE(COUNT(DISTINCT r.session_id) FILTER (WHERE r.had_rework)::float / NULLIF(COUNT(DISTINCT r.session_id), 0), 0) AS "reworkRate",
        COALESCE(COUNT(DISTINCT r.session_id) FILTER (WHERE r.had_revert)::float / NULLIF(COUNT(DISTINCT r.session_id), 0), 0) AS "revertRate"
      FROM session_turns st
      JOIN ranked_sessions r ON r.session_id = st.session_id
                           AND r.org_id = st.org_id
                           AND r.tool = st.tool
      WHERE st.turn_role = 'user'
      GROUP BY tier, "complexityBucket"
      ORDER BY tier, "complexityBucket"
    `, params);

    return NextResponse.json(rows);
  } catch (err: any) {
    console.error('[research-specificity-error]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
