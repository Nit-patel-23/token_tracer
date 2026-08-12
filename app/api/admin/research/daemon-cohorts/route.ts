/**
 * GET /api/admin/research/daemon-cohorts?range=30d&org=&tool=
 * Superadmin-only. Groups tool-error rate by `members.daemon_version` so a
 * regression introduced by a specific daemon release shows up as a cohort
 * with an elevated error rate.
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

  const { whereClause, params } = buildResearchFilters(
    searchParams,
    "ss.started_at >= NOW() - $1::int * INTERVAL '1 day'",
    [days],
    [
      { param: 'org', column: 'ss.team_id::text' },
      { param: 'tool', column: 'ss.source' },
    ],
  );

  try {
    const { rows } = await query(`
      SELECT
        COALESCE(m.daemon_version, 'unknown') AS "daemonVersion",
        COUNT(DISTINCT ss.session_id)::int AS "sessionCount",
        COALESCE(
          COUNT(*) FILTER (WHERE st.turn_role = 'assistant' AND st.tool_error_flag)::float
            / NULLIF(COUNT(*) FILTER (WHERE st.turn_role = 'assistant'), 0),
          0
        ) AS "errorRate",
        MIN(ss.started_at) AS "firstSeen",
        MAX(ss.started_at) AS "lastSeen"
      FROM sync_sessions ss
      JOIN members m ON m.id = ss.member_id
      JOIN session_turns st ON st.session_id = ss.session_id
                            AND st.org_id = ss.team_id::text
                            AND st.user_id = ss.member_id::text
                            AND st.tool = ss.source
      WHERE ${whereClause}
      GROUP BY "daemonVersion"
      ORDER BY "errorRate" DESC
    `, params);

    return NextResponse.json({ cohorts: rows });
  } catch (err: any) {
    console.error('[research-daemon-cohorts-error]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
