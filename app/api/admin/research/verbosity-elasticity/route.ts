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

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const session = getSessionFromCookie(cookieStore.toString());
  if (!session || session.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const searchParams = req.nextUrl.searchParams;
  const days = parseDays(searchParams.get('range'));
  const modelFilter = searchParams.get('model');
  const intentFilter = searchParams.get('intent');

  // Build filter conditions
  const conditions = ["ss.started_at >= NOW() - $1::int * INTERVAL '1 day'"];
  const params: any[] = [days];
  let paramIdx = 2;

  if (modelFilter) {
    conditions.push(`st.model = $${paramIdx}`);
    params.push(modelFilter);
    paramIdx++;
  }
  if (intentFilter) {
    conditions.push(`st.intent_category = $${paramIdx}`);
    params.push(intentFilter);
    paramIdx++;
  }

  const whereClause = conditions.join(' AND ');

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
