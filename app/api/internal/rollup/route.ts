/**
 * Internal cron endpoint — nightly rollup.
 * Called by Vercel Cron (see vercel.json). Protected by CRON_SECRET.
 *
 * Aggregates raw session / ingest data into:
 *   - daily_org_usage        (cost + token totals per org/tool/model/day)
 *   - daily_pipeline_health  (ingest health per daemon/day)
 *   - daily_behavior_rollup  (rework loops + errors per org/tool/day)
 *
 * All upserts are ON CONFLICT DO UPDATE — safe to re-run for the same day.
 */
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/team/db';
import { cronSecret } from '@/lib/team/env';

function isCronAuthorized(req: NextRequest): boolean {
  const secret = cronSecret();
  if (!secret) return false; // CRON_SECRET not set → deny
  const auth = req.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;
  // Also allow direct header for Vercel Cron
  const cronHeader = req.headers.get('x-cron-secret');
  return cronHeader === secret;
}

export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return runRollup();
}

// Vercel Cron hits GET
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return runRollup();
}

async function runRollup(): Promise<NextResponse> {
  const startedAt = Date.now();
  const errors: string[] = [];

  // ── 1. daily_org_usage ────────────────────────────────────────────────────
  // Aggregate sync_sessions into per-org/tool/model/day rows.
  // Uses the team_id as org_id. list_price_cost comes from the api_cost column
  // (which ingest.ts calculates using team pricing overrides already stored in
  // model_pricing). actual_cost mirrors it — when override pricing differs from
  // list price, ingest already stores the overridden cost in api_cost.
  try {
    await query(`
      INSERT INTO daily_org_usage (day, org_id, tool, model,
        input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
        list_price_cost, actual_cost, session_count)
      SELECT
        COALESCE(s.ended_at, s.started_at, s.synced_at)::date AS day,
        s.team_id::text AS org_id,
        COALESCE(NULLIF(s.source, ''), 'unknown') AS tool,
        COALESCE(NULLIF(s.model, ''), 'unknown') AS model,
        SUM(s.tokens_in)           AS input_tokens,
        SUM(s.tokens_out)          AS output_tokens,
        SUM(s.tokens_cache_read)   AS cache_read_tokens,
        SUM(s.tokens_cache_write)  AS cache_write_tokens,
        SUM(COALESCE(s.api_cost, 0))::numeric(12,4) AS list_price_cost,
        SUM(COALESCE(s.api_cost, 0))::numeric(12,4) AS actual_cost,
        COUNT(*)::int AS session_count
      FROM sync_sessions s
      WHERE
        COALESCE(s.ended_at, s.started_at, s.synced_at) IS NOT NULL
        AND COALESCE(s.ended_at, s.started_at, s.synced_at)::date = CURRENT_DATE - 1
      GROUP BY 1, 2, 3, 4
      ON CONFLICT (day, org_id, tool, model) DO UPDATE SET
        input_tokens       = EXCLUDED.input_tokens,
        output_tokens      = EXCLUDED.output_tokens,
        cache_read_tokens  = EXCLUDED.cache_read_tokens,
        cache_write_tokens = EXCLUDED.cache_write_tokens,
        list_price_cost    = EXCLUDED.list_price_cost,
        actual_cost        = EXCLUDED.actual_cost,
        session_count      = EXCLUDED.session_count
    `);
  } catch (err) {
    errors.push(`daily_org_usage: ${(err as Error).message}`);
  }

  // ── 2. daily_pipeline_health ──────────────────────────────────────────────
  // One row per member-as-daemon per day. Uses ingest_events as the health
  // signal — each successful batch that arrived gets counted.
  // Ingestion lag = time between synced_at and ended_at on sync_sessions.
  try {
    await query(`
      INSERT INTO daily_pipeline_health (day, daemon_id, org_id,
        last_heartbeat, batches_received, batches_failed,
        avg_ingestion_lag_seconds, parse_errors, sanitize_errors)
      SELECT
        ie.created_at::date                      AS day,
        ie.member_id::text                       AS daemon_id,
        ie.team_id::text                         AS org_id,
        MAX(ie.created_at)                       AS last_heartbeat,
        COUNT(*) FILTER (WHERE ie.status = 'ok')::int         AS batches_received,
        COUNT(*) FILTER (WHERE ie.status != 'ok')::int        AS batches_failed,
        COALESCE((
          SELECT AVG(
            EXTRACT(EPOCH FROM (s.synced_at - COALESCE(s.ended_at, s.started_at)))
          )::int
          FROM sync_sessions s
          WHERE s.member_id = ie.member_id
            AND s.synced_at::date = ie.created_at::date
            AND s.ended_at IS NOT NULL
        ), 0)                                    AS avg_ingestion_lag_seconds,
        0                                        AS parse_errors,
        0                                        AS sanitize_errors
      FROM ingest_events ie
      WHERE ie.created_at::date = CURRENT_DATE - 1
      GROUP BY ie.created_at::date, ie.member_id, ie.team_id
      ON CONFLICT (day, daemon_id) DO UPDATE SET
        last_heartbeat          = EXCLUDED.last_heartbeat,
        batches_received        = EXCLUDED.batches_received,
        batches_failed          = EXCLUDED.batches_failed,
        avg_ingestion_lag_seconds = EXCLUDED.avg_ingestion_lag_seconds,
        parse_errors            = EXCLUDED.parse_errors,
        sanitize_errors         = EXCLUDED.sanitize_errors
    `);
  } catch (err) {
    errors.push(`daily_pipeline_health: ${(err as Error).message}`);
  }

  // ── 3. daily_behavior_rollup ──────────────────────────────────────────────
  try {
    await query(`
      INSERT INTO daily_behavior_rollup (day, org_id, tool,
        rework_loop_count, tool_error_count, total_turns)
      SELECT
        COALESCE(s.ended_at, s.started_at, s.synced_at)::date AS day,
        s.team_id::text AS org_id,
        COALESCE(NULLIF(s.source, ''), 'unknown') AS tool,
        SUM(s.rework_loops)::int   AS rework_loop_count,
        SUM(s.tool_errors)::int    AS tool_error_count,
        SUM(s.tool_calls)::int     AS total_turns
      FROM sync_sessions s
      WHERE
        COALESCE(s.ended_at, s.started_at, s.synced_at) IS NOT NULL
        AND COALESCE(s.ended_at, s.started_at, s.synced_at)::date = CURRENT_DATE - 1
      GROUP BY 1, 2, 3
      ON CONFLICT (day, org_id, tool) DO UPDATE SET
        rework_loop_count = EXCLUDED.rework_loop_count,
        tool_error_count  = EXCLUDED.tool_error_count,
        total_turns       = EXCLUDED.total_turns
    `);
  } catch (err) {
    errors.push(`daily_behavior_rollup: ${(err as Error).message}`);
  }

  const elapsed = Date.now() - startedAt;

  if (errors.length > 0) {
    return NextResponse.json({
      ok: false,
      elapsed_ms: elapsed,
      errors,
    }, { status: 500 });
  }

  return NextResponse.json({ ok: true, elapsed_ms: elapsed });
}
