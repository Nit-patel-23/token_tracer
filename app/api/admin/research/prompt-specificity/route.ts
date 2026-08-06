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
  const org = searchParams.get('org');
  const tool = searchParams.get('tool');
  const model = searchParams.get('model');

  // Build filter conditions
  const conditions = ["ss.started_at >= NOW() - $1::int * INTERVAL '1 day'"];
  const params: any[] = [days];
  let paramIdx = 2;

  if (org) {
    conditions.push(`so.org_id = $${paramIdx}`);
    params.push(org);
    paramIdx++;
  }
  if (tool) {
    conditions.push(`so.tool = $${paramIdx}`);
    params.push(tool);
    paramIdx++;
  }
  if (model) {
    conditions.push(`so.model = $${paramIdx}`);
    params.push(model);
    paramIdx++;
  }

  const whereClause = conditions.join(' AND ');

  try {
    const { rows } = await query(`
      WITH ranked_sessions AS (
        SELECT 
          so.session_id,
          so.had_rework,
          so.had_revert,
          so.total_input_tokens,
          so.total_output_tokens,
          so.lines_changed,
          NTILE(3) OVER (ORDER BY so.complexity_score) AS complexity_bucket
        FROM session_outcomes so
        JOIN sync_sessions ss ON ss.session_id = so.session_id
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
