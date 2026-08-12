/**
 * GET /api/admin/research/error-spikes?range=30d&model=&tool=&org=
 * Superadmin-only. Daily tool-error-rate series with rolling-baseline spike
 * detection, plus a per-day tool_name breakdown (which tool is driving a
 * given day's error rate) sourced from `session_tool_errors`.
 */
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/team/db';
import { buildResearchFilters, parseRangeDays, requireSuperadminApi } from '@/lib/team/researchQuery';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const forbidden = requireSuperadminApi(req);
  if (forbidden) return forbidden;

  const searchParams = req.nextUrl.searchParams;
  const days = parseRangeDays(searchParams.get('range'), { def: 30, max: 90 });

  const { whereClause: seriesWhere, params: seriesParams } = buildResearchFilters(
    searchParams,
    "ss.started_at >= NOW() - $1::int * INTERVAL '1 day'",
    [days],
    [
      { param: 'model', column: 'st.model' },
      { param: 'tool', column: 'st.tool' },
      { param: 'org', column: 'st.org_id' },
    ],
  );

  const { whereClause: toolWhere, params: toolParams } = buildResearchFilters(
    searchParams,
    "ste.is_error = true AND ste.created_at >= NOW() - $1::int * INTERVAL '1 day'",
    [days],
    [
      { param: 'model', column: 'ste.model' },
      { param: 'tool', column: 'ste.tool' },
      { param: 'org', column: 'ste.org_id' },
    ],
  );

  try {
    const { rows: series } = await query(`
      WITH daily AS (
        SELECT
          ss.started_at::date AS day,
          COUNT(*) FILTER (WHERE st.turn_role = 'assistant')::int AS "totalTurns",
          COUNT(*) FILTER (WHERE st.turn_role = 'assistant' AND st.tool_error_flag)::int AS "errorTurns"
        FROM session_turns st
        JOIN sync_sessions ss ON ss.session_id = st.session_id
                             AND st.org_id = ss.team_id::text
                             AND st.user_id = ss.member_id::text
                             AND st.tool = ss.source
        WHERE ${seriesWhere}
        GROUP BY 1
      )
      SELECT
        day,
        "totalTurns",
        "errorTurns",
        (CASE WHEN "totalTurns" = 0 THEN 0 ELSE "errorTurns"::float / "totalTurns" END) AS "errorRate",
        AVG(CASE WHEN "totalTurns" = 0 THEN 0 ELSE "errorTurns"::float / "totalTurns" END)
          OVER (ORDER BY day ROWS BETWEEN 7 PRECEDING AND 1 PRECEDING) AS "rollingMean",
        STDDEV(CASE WHEN "totalTurns" = 0 THEN 0 ELSE "errorTurns"::float / "totalTurns" END)
          OVER (ORDER BY day ROWS BETWEEN 7 PRECEDING AND 1 PRECEDING) AS "rollingStddev"
      FROM daily
      ORDER BY day ASC
    `, seriesParams);

    const withSpikes = series.map((r) => {
      const mean = r.rollingMean == null ? null : Number(r.rollingMean);
      const stddev = r.rollingStddev == null ? null : Number(r.rollingStddev);
      const isSpike = mean != null && stddev != null && stddev > 0 && Number(r.errorRate) > mean + 2 * stddev;
      return { ...r, isSpike };
    });

    const { rows: toolBreakdown } = await query(`
      SELECT
        ste.created_at::date AS day,
        ste.tool_name AS "toolName",
        COUNT(*)::int AS "errorCount"
      FROM session_tool_errors ste
      WHERE ${toolWhere}
      GROUP BY 1, 2
      ORDER BY 1 ASC, "errorCount" DESC
    `, toolParams);

    // Drill-down: for a selected spike day (?day=2026-08-01), surface the
    // actual failing tool calls (args + the prompt that led to them).
    const drilldownDay = searchParams.get('day');
    let drilldown: unknown[] | null = null;
    if (drilldownDay) {
      const { whereClause: ddWhere, params: ddParams } = buildResearchFilters(
        searchParams,
        'ste.is_error = true AND ste.created_at::date = $1::date',
        [drilldownDay],
        [
          { param: 'model', column: 'ste.model' },
          { param: 'tool', column: 'ste.tool' },
          { param: 'org', column: 'ste.org_id' },
          { param: 'toolName', column: 'ste.tool_name' },
        ],
      );
      const { rows } = await query(`
        SELECT
          ste.session_id AS "sessionId",
          ste.tool_name AS "toolName",
          ste.tool_args_summary AS "toolArgsSummary",
          ste.created_at AS "createdAt",
          ste.model,
          ste.tool,
          st.prompt_text_sanitized AS "promptText"
        FROM session_tool_errors ste
        LEFT JOIN session_turns st ON st.id = ste.turn_id
        WHERE ${ddWhere}
        ORDER BY ste.created_at DESC
        LIMIT 200
      `, ddParams);
      drilldown = rows;
    }

    return NextResponse.json({ series: withSpikes, toolBreakdown, drilldown });
  } catch (err: any) {
    console.error('[research-error-spikes-error]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
