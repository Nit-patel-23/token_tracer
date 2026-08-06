/**
 * GET /api/admin/usage-trends?range=30d&groupBy=tool
 * Superadmin-only. Returns platform-wide usage and growth data.
 * Queries live from sync_sessions + ingest_events — no rollup dependency.
 */
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionFromCookie } from '@/lib/auth';
import { query } from '@/lib/team/db';

function parseDays(range: string | null): number {
  if (!range) return 30;
  const m = range.match(/^(\d+)d$/);
  return m ? Math.min(Math.max(1, Number(m[1])), 90) : 30;
}

export async function GET(req: NextRequest) {
  // ── Auth: superadmin only ─────────────────────────────────────────────────
  const cookieStore = await cookies();
  const session = getSessionFromCookie(cookieStore.toString());
  if (!session || session.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const days = parseDays(req.nextUrl.searchParams.get('range'));
  const groupBy = req.nextUrl.searchParams.get('groupBy') || 'tool';

  // ── 1. Token trend by tool/source (live) ─────────────────────────────────
  const { rows: tokensByTool } = await query(`
    SELECT
      COALESCE(s.ended_at, s.started_at, s.synced_at)::date AS day,
      COALESCE(NULLIF(s.source, ''), 'unknown')              AS tool,
      SUM(s.tokens_in)::bigint                               AS input_tokens,
      SUM(s.tokens_out)::bigint                              AS output_tokens,
      SUM(s.tokens_cache_read)::bigint                       AS cache_read_tokens,
      COUNT(*)::int                                          AS session_count
    FROM sync_sessions s
    WHERE COALESCE(s.ended_at, s.started_at, s.synced_at) >= CURRENT_DATE - $1::int
    GROUP BY 1, 2
    ORDER BY 1 ASC, 2 ASC
  `, [days]);

  // ── 2. Model mix over time (live) ─────────────────────────────────────────
  const { rows: modelMix } = await query(`
    SELECT
      COALESCE(s.ended_at, s.started_at, s.synced_at)::date  AS day,
      COALESCE(NULLIF(s.model, ''), 'unknown')                AS model,
      SUM(s.tokens_in + s.tokens_out)::bigint                 AS total_tokens,
      COUNT(*)::int                                           AS session_count
    FROM sync_sessions s
    WHERE COALESCE(s.ended_at, s.started_at, s.synced_at) >= CURRENT_DATE - $1::int
    GROUP BY 1, 2
    ORDER BY 1 ASC, total_tokens DESC
  `, [days]);

  // ── 3. Top models overall for punchcard (live) ────────────────────────────
  const { rows: topModels } = await query(`
    SELECT
      COALESCE(NULLIF(s.model, ''), 'unknown') AS model,
      SUM(s.tokens_in + s.tokens_out)::bigint  AS total_tokens,
      COUNT(*)::int                             AS session_count
    FROM sync_sessions s
    WHERE COALESCE(s.ended_at, s.started_at, s.synced_at) >= CURRENT_DATE - $1::int
    GROUP BY 1
    ORDER BY total_tokens DESC
    LIMIT 10
  `, [days]);

  // ── 4. Daemon activity (live from ingest_events) ──────────────────────────
  const { rows: daemonActivity } = await query(`
    SELECT
      COUNT(DISTINCT m.id)::int                                       AS total_registered,
      COUNT(DISTINCT ie.member_id) FILTER (
        WHERE ie.created_at >= NOW() - INTERVAL '24 hours'
      )::int                                                          AS active_24h,
      COUNT(DISTINCT ie.member_id) FILTER (
        WHERE ie.created_at >= NOW() - INTERVAL '7 days'
      )::int                                                          AS active_7d
    FROM members m
    LEFT JOIN ingest_events ie ON ie.member_id = m.id
  `);

  // ── 5. New orgs over time (live) ──────────────────────────────────────────
  const { rows: orgGrowth } = await query(`
    SELECT
      created_at::date AS day,
      COUNT(*)::int    AS new_orgs
    FROM teams
    WHERE created_at::date >= CURRENT_DATE - $1::int
    GROUP BY 1
    ORDER BY 1 ASC
  `, [days]);

  // ── 6. Platform daily summary (live) ─────────────────────────────────────
  const { rows: dailySummary } = await query(`
    SELECT
      COALESCE(s.ended_at, s.started_at, s.synced_at)::date            AS day,
      SUM(s.tokens_in + s.tokens_out + s.tokens_cache_read)::bigint    AS total_tokens,
      COUNT(*)::int                                                      AS total_sessions,
      COUNT(DISTINCT s.team_id)::int                                     AS active_orgs
    FROM sync_sessions s
    WHERE COALESCE(s.ended_at, s.started_at, s.synced_at) >= CURRENT_DATE - $1::int
    GROUP BY 1
    ORDER BY 1 ASC
  `, [days]);

  return NextResponse.json({
    range_days: days,
    group_by: groupBy,
    tokens_by_tool: tokensByTool,
    model_mix: modelMix,
    top_models: topModels,
    daemon_activity: daemonActivity[0] ?? {},
    org_growth: orgGrowth,
    daily_summary: dailySummary,
  });
}
