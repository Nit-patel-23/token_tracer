/**
 * GET /api/admin/pipeline-health?range=7d
 * Superadmin-only. Reads directly from the tables daemons write to:
 *   - sync_sessions  (token/cost data per session)
 *   - ingest_events  (one row per sync batch — the heartbeat signal)
 *   - members        (daemon registry)
 */
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionFromCookie } from '@/lib/auth';
import { query } from '@/lib/team/db';

function parseDays(range: string | null): number {
  if (!range) return 7;
  const m = range.match(/^(\d+)d$/);
  return m ? Math.min(Math.max(1, Number(m[1])), 90) : 7;
}

export async function GET(req: NextRequest) {
  // ── Auth: superadmin only ─────────────────────────────────────────────────
  const cookieStore = await cookies();
  const session = getSessionFromCookie(cookieStore.toString());
  if (!session || session.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const days = parseDays(req.nextUrl.searchParams.get('range'));

  // ── 1. Daemon health — from ingest_events + members ───────────────────────
  // Last heartbeat = most recent ingest_event per member.
  // Batch counts use the full window.
  const { rows: daemonRows } = await query(`
    SELECT
      m.id::text                    AS daemon_id,
      m.display_name                AS daemon_name,
      m.daemon_version              AS daemon_version,
      t.id::text                    AS org_id,
      t.name                        AS org_name,
      MAX(ie.created_at)            AS last_heartbeat,
      COUNT(ie.id) FILTER (
        WHERE ie.status = 'ok'
          AND ie.created_at >= NOW() - $1::int * INTERVAL '1 day'
      )::int                        AS batches_received,
      COUNT(ie.id) FILTER (
        WHERE ie.status != 'ok'
          AND ie.created_at >= NOW() - $1::int * INTERVAL '1 day'
      )::int                        AS batches_failed,
      COALESCE((
        SELECT AVG(
          EXTRACT(EPOCH FROM (s.synced_at - COALESCE(s.ended_at, s.started_at)))
        )::int
        FROM sync_sessions s
        WHERE s.member_id = m.id
          AND s.synced_at >= NOW() - $1::int * INTERVAL '1 day'
          AND s.ended_at IS NOT NULL
          AND s.synced_at > COALESCE(s.ended_at, s.started_at)
      ), 0)                         AS avg_ingestion_lag_seconds
    FROM members m
    LEFT JOIN teams t ON t.id = m.team_id
    LEFT JOIN ingest_events ie ON ie.member_id = m.id
    GROUP BY m.id, m.display_name, m.daemon_version, t.id, t.name
    ORDER BY last_heartbeat DESC NULLS LAST
  `, [days]);

  // ── 2. Ingestion lag trend — from sync_sessions ───────────────────────────
  // synced_at - ended_at gives the true ingestion lag per session.
  const { rows: lagTrend } = await query(`
    SELECT
      s.synced_at::date                                                       AS day,
      AVG(
        EXTRACT(EPOCH FROM (s.synced_at - COALESCE(s.ended_at, s.started_at)))
      )::int                                                                  AS avg_lag_seconds
    FROM sync_sessions s
    WHERE s.synced_at >= CURRENT_DATE - $1::int
      AND s.ended_at IS NOT NULL
      AND s.synced_at > COALESCE(s.ended_at, s.started_at)
    GROUP BY 1
    ORDER BY 1 ASC
  `, [days]);

  // ── 3. Failure rate per daemon — from ingest_events ──────────────────────
  const { rows: failureRows } = await query(`
    SELECT
      m.id::text        AS daemon_id,
      m.display_name    AS daemon_name,
      COUNT(ie.id) FILTER (WHERE ie.status = 'ok')::int   AS total_received,
      COUNT(ie.id) FILTER (WHERE ie.status != 'ok')::int  AS total_failed,
      ROUND(
        CASE WHEN COUNT(ie.id) = 0 THEN 0
             ELSE COUNT(ie.id) FILTER (WHERE ie.status != 'ok')::numeric
                  / COUNT(ie.id) * 100
        END, 2
      ) AS failure_rate_pct
    FROM members m
    LEFT JOIN ingest_events ie ON ie.member_id = m.id
      AND ie.created_at >= NOW() - $1::int * INTERVAL '1 day'
    GROUP BY m.id, m.display_name
    HAVING COUNT(ie.id) > 0
    ORDER BY failure_rate_pct DESC NULLS LAST
  `, [days]);

  // ── 4. Schema health ───────────────────────────────────────────────────────
  const { rows: schemaRows } = await query(`
    SELECT COUNT(*) AS table_count,
           MAX(last_analyze) AS last_analyzed
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
  `);

  // ── 5. Active vs total daemons ────────────────────────────────────────────
  const { rows: activeRows } = await query(`
    SELECT
      COUNT(DISTINCT m.id)::int AS total_registered,
      COUNT(DISTINCT ie.member_id) FILTER (
        WHERE ie.created_at >= NOW() - INTERVAL '24 hours'
      )::int AS active_24h
    FROM members m
    LEFT JOIN ingest_events ie ON ie.member_id = m.id
  `);

  // ── 6. Latest release version ─────────────────────────────────────────────
  const { rows: latestReleaseRows } = await query(`
    SELECT version FROM daemon_releases
    WHERE active = true
    ORDER BY released_at DESC
    LIMIT 1
  `);
  const latestReleaseVersion = latestReleaseRows[0]?.version || null;

  return NextResponse.json({
    range_days: days,
    daemons: daemonRows,
    lag_trend: lagTrend,
    failure_rates: failureRows,
    schema: {
      table_count: Number(schemaRows[0]?.table_count ?? 0),
      last_analyzed: schemaRows[0]?.last_analyzed ?? null,
    },
    active_24h: Number(activeRows[0]?.active_24h ?? 0),
    total_known: Number(activeRows[0]?.total_registered ?? 0),
    latest_version: latestReleaseVersion,
  });
}
