/**
 * GET /api/admin/cost-overview?range=30d
 * Superadmin-only. Returns platform-wide cost intelligence.
 * Queries live from sync_sessions — no rollup dependency.
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

  // ── 1. Daily cost trend (live from sync_sessions) ─────────────────────────
  const { rows: costTrend } = await query(`
    SELECT
      COALESCE(s.ended_at, s.started_at, s.synced_at)::date AS day,
      SUM(COALESCE(s.api_cost, 0))::float                   AS list_price_total,
      SUM(COALESCE(s.api_cost, 0))::float                   AS actual_cost_total,
      COUNT(*)::int                                          AS session_count
    FROM sync_sessions s
    WHERE COALESCE(s.ended_at, s.started_at, s.synced_at) >= CURRENT_DATE - $1::int
    GROUP BY 1
    ORDER BY 1 ASC
  `, [days]);

  // ── 2. Cache savings (live) ───────────────────────────────────────────────
  const { rows: cacheSavings } = await query(`
    SELECT
      COALESCE(s.ended_at, s.started_at, s.synced_at)::date AS day,
      SUM(s.tokens_cache_read)::bigint                       AS cache_read_tokens,
      SUM(s.tokens_cache_write)::bigint                      AS cache_write_tokens,
      SUM(
        CASE
          WHEN s.tokens_in > 0 AND s.api_cost > 0
          THEN s.tokens_cache_read::float * (s.api_cost / s.tokens_in) * 0.9
          ELSE 0
        END
      )::float AS estimated_cache_savings_usd
    FROM sync_sessions s
    WHERE COALESCE(s.ended_at, s.started_at, s.synced_at) >= CURRENT_DATE - $1::int
    GROUP BY 1
    ORDER BY 1 ASC
  `, [days]);

  // ── 3. Top orgs by cost (live) ────────────────────────────────────────────
  const { rows: topOrgs } = await query(`
    SELECT
      s.team_id::text                         AS org_id,
      t.name                                  AS org_name,
      SUM(COALESCE(s.api_cost, 0))::float     AS total_actual_cost,
      SUM(COALESCE(s.api_cost, 0))::float     AS total_list_cost,
      COUNT(*)::int                           AS total_sessions,
      SUM(s.tokens_in)::bigint                AS total_input_tokens,
      SUM(s.tokens_out)::bigint               AS total_output_tokens
    FROM sync_sessions s
    LEFT JOIN teams t ON t.id = s.team_id
    WHERE COALESCE(s.ended_at, s.started_at, s.synced_at) >= CURRENT_DATE - $1::int
    GROUP BY s.team_id, t.name
    ORDER BY total_actual_cost DESC NULLS LAST
    LIMIT 20
  `, [days]);

  // ── 4. Pricing override audit ─────────────────────────────────────────────
  const { rows: overrideAudit } = await query(`
    SELECT
      mp.team_id::text   AS org_id,
      t.name             AS org_name,
      mp.model_pattern,
      mp.cost_in_per_m,
      mp.cost_out_per_m,
      mp.cost_cache_read_per_m,
      mp.created_at
    FROM model_pricing mp
    LEFT JOIN teams t ON t.id = mp.team_id
    WHERE mp.team_id IS NOT NULL
    ORDER BY t.name ASC, mp.model_pattern ASC
  `);

  // ── 5. Platform totals ────────────────────────────────────────────────────
  const { rows: totals } = await query(`
    SELECT
      SUM(COALESCE(s.api_cost, 0))::float   AS total_list_price,
      SUM(COALESCE(s.api_cost, 0))::float   AS total_actual_cost,
      COUNT(*)::int                          AS total_sessions,
      SUM(s.tokens_in)::bigint               AS total_input_tokens,
      SUM(s.tokens_out)::bigint              AS total_output_tokens,
      SUM(s.tokens_cache_read)::bigint       AS total_cache_read_tokens
    FROM sync_sessions s
    WHERE COALESCE(s.ended_at, s.started_at, s.synced_at) >= CURRENT_DATE - $1::int
  `, [days]);

  return NextResponse.json({
    range_days: days,
    cost_trend: costTrend,
    cache_savings: cacheSavings,
    top_orgs: topOrgs,
    override_audit: overrideAudit,
    totals: totals[0] ?? {},
  });
}
