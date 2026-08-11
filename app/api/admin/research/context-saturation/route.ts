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
  const toolFilter = searchParams.get('tool');

  // Build filter conditions
  const conditions = ["ss.started_at >= NOW() - $1::int * INTERVAL '1 day'"];
  const params: any[] = [days];
  let paramIdx = 2;

  if (modelFilter) {
    conditions.push(`st.model = $${paramIdx}`);
    params.push(modelFilter);
    paramIdx++;
  }
  if (toolFilter) {
    conditions.push(`st.tool = $${paramIdx}`);
    params.push(toolFilter);
    paramIdx++;
  }

  const whereClause = conditions.join(' AND ');

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

    return NextResponse.json({ rows, inflectionPoints });
  } catch (err: any) {
    console.error('[research-saturation-error]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
