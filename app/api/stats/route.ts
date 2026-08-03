/**
 * Personal dashboard stats endpoint — DB-backed.
 * GET /api/stats?from=YYYY-MM-DD&to=YYYY-MM-DD&source=cursor&all=1
 *
 * Requires valid app_session cookie. Returns aggregated stats for the logged-in member.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/lib/auth';
import { query } from '@/lib/team/db';
import { normalizeDateParam } from '@/lib/analytics.mjs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = getSessionFromCookie(req.headers.get('cookie'));
  if (!session) {
    return NextResponse.json({ error: 'not authenticated', redirect: '/login' }, { status: 401 });
  }

  if (session.role !== 'user' || !session.memberId) {
    return NextResponse.json({ error: 'personal stats are for regular users only' }, { status: 403 });
  }

  try {
    const url = req.nextUrl;
    const src = url.searchParams.get('source');
    const allParam = url.searchParams.get('all');
    const all = allParam === '1' || allParam === 'true';
    let from = normalizeDateParam(url.searchParams.get('from'));
    let to = normalizeDateParam(url.searchParams.get('to'));
    if (from && to && from > to) { const tmp = from; from = to; to = tmp; }
    const useAll = all || (!from && !to);

    const params: unknown[] = [session.memberId];
    let dateFilter = '';
    if (!useAll) {
      if (from) { params.push(from); dateFilter += ` AND COALESCE(s.ended_at, s.started_at, s.synced_at)::date >= $${params.length}::date`; }
      if (to)   { params.push(to);   dateFilter += ` AND COALESCE(s.ended_at, s.started_at, s.synced_at)::date <= $${params.length}::date`; }
    }
    if (src && src !== 'all') { params.push(src); dateFilter += ` AND s.source = $${params.length}`; }

    // Totals
    const { rows: [totals] } = await query(`
      SELECT
        count(*)::int AS sessions,
        coalesce(sum(s.tokens_in), 0)::bigint AS tokens_in,
        coalesce(sum(s.tokens_out), 0)::bigint AS tokens_out,
        coalesce(sum(s.tokens_cache_read), 0)::bigint AS cache_read,
        coalesce(sum(s.tokens_cache_write), 0)::bigint AS cache_write,
        coalesce(sum(s.api_cost), 0)::float AS api_cost,
        coalesce(sum(s.edits), 0)::int AS edits,
        coalesce(sum(s.additions), 0)::int AS additions,
        coalesce(sum(s.deletions), 0)::int AS deletions,
        coalesce(sum(s.changed_lines), 0)::int AS changed_lines,
        coalesce(sum(s.tool_calls), 0)::int AS tool_calls,
        coalesce(sum(s.tool_errors), 0)::int AS tool_errors,
        coalesce(sum(s.rework_loops), 0)::int AS rework_loops,
        coalesce(sum(s.corrections), 0)::int AS corrections,
        coalesce(sum(CASE WHEN s.abandoned THEN 1 ELSE 0 END), 0)::int AS abandoned
      FROM sync_sessions s
      WHERE s.member_id = $1 ${dateFilter}
    `, params);

    // Per-day breakdown
    const { rows: perDay } = await query(`
      SELECT
        COALESCE(s.ended_at, s.started_at, s.synced_at)::date AS date,
        count(*)::int AS sessions,
        coalesce(sum(s.tokens_in + s.tokens_out), 0)::bigint AS tokens,
        coalesce(sum(s.api_cost), 0)::float AS api_cost,
        coalesce(sum(s.edits), 0)::int AS edits
      FROM sync_sessions s
      WHERE s.member_id = $1 ${dateFilter}
      GROUP BY 1 ORDER BY 1
    `, params);

    // Per-source breakdown
    const { rows: perSource } = await query(`
      SELECT
        s.source,
        count(*)::int AS sessions,
        coalesce(sum(s.tokens_in + s.tokens_out), 0)::bigint AS tokens,
        coalesce(sum(s.api_cost), 0)::float AS api_cost,
        coalesce(sum(s.edits), 0)::int AS edits
      FROM sync_sessions s
      WHERE s.member_id = $1 ${dateFilter}
      GROUP BY s.source ORDER BY tokens DESC
    `, params);

    // Per-model breakdown
    const { rows: perModel } = await query(`
      SELECT
        s.model,
        count(*)::int AS sessions,
        coalesce(sum(s.tokens_in + s.tokens_out), 0)::bigint AS tokens,
        coalesce(sum(s.api_cost), 0)::float AS api_cost
      FROM sync_sessions s
      WHERE s.member_id = $1 ${dateFilter} AND s.model IS NOT NULL
      GROUP BY s.model ORDER BY tokens DESC LIMIT 20
    `, params);

    // Top tools
    const { rows: topTools } = await query(`
      SELECT t.tool_name, sum(t.call_count)::int AS total_calls
      FROM sync_session_tools t
      JOIN sync_sessions s ON s.id = t.sync_session_id
      WHERE s.member_id = $1 ${dateFilter}
      GROUP BY t.tool_name ORDER BY total_calls DESC LIMIT 20
    `, params);

    return NextResponse.json({
      window: { from: from ?? null, to: to ?? null, all: useAll },
      totals: {
        sessions: totals?.sessions ?? 0,
        tokensIn: Number(totals?.tokens_in ?? 0),
        tokensOut: Number(totals?.tokens_out ?? 0),
        cacheRead: Number(totals?.cache_read ?? 0),
        cacheWrite: Number(totals?.cache_write ?? 0),
        edits: totals?.edits ?? 0,
        additions: totals?.additions ?? 0,
        deletions: totals?.deletions ?? 0,
        changedLines: totals?.changed_lines ?? 0,
        toolCalls: totals?.tool_calls ?? 0,
        toolErrors: totals?.tool_errors ?? 0,
        reworkLoops: totals?.rework_loops ?? 0,
        corrections: totals?.corrections ?? 0,
        abandoned: totals?.abandoned ?? 0,
      },
      cost: {
        total: totals?.api_cost ?? 0,
        currency: 'USD',
      },
      perDay: perDay.map((r: any) => ({
        date: String(r.date).slice(0, 10),
        sessions: r.sessions,
        tokens: Number(r.tokens),
        apiCost: r.api_cost,
        edits: r.edits,
      })),
      sources: perSource.map((r: any) => ({
        source: r.source,
        sessions: r.sessions,
        tokens: Number(r.tokens),
        apiCost: r.api_cost,
        edits: r.edits,
      })),
      models: perModel.map((r: any) => ({
        model: r.model,
        sessions: r.sessions,
        tokens: Number(r.tokens),
        apiCost: r.api_cost,
      })),
      tools: topTools.map((r: any) => ({
        name: r.tool_name,
        calls: r.total_calls,
      })),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
