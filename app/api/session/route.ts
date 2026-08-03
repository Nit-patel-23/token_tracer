/**
 * Personal session detail endpoint — DB-backed.
 * GET /api/session?id=<sessionId>
 *
 * Returns aggregated stats for a single session. Since DB doesn't store
 * individual events, this returns the summary + tool/file breakdowns.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/lib/auth';
import { query } from '@/lib/team/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const appSession = getSessionFromCookie(req.headers.get('cookie'));
  if (!appSession) {
    return NextResponse.json({ error: 'not authenticated', redirect: '/login' }, { status: 401 });
  }

  if (appSession.role !== 'user' || !appSession.memberId) {
    return NextResponse.json({ error: 'personal dashboard is for regular users only' }, { status: 403 });
  }

  try {
    const sessionId = (req.nextUrl.searchParams.get('id') || '').toLowerCase();
    if (!sessionId) {
      return NextResponse.json({ error: 'id parameter is required' }, { status: 400 });
    }

    // Look up by session_id OR the UUID id column, scoped to this member
    const { rows: [row] } = await query(`
      SELECT s.*
      FROM sync_sessions s
      WHERE s.member_id = $1
        AND (lower(s.session_id) = $2 OR lower(s.id::text) = $2)
      LIMIT 1
    `, [appSession.memberId, sessionId]);

    if (!row) {
      return NextResponse.json({ error: 'session not found' }, { status: 404 });
    }

    // Fetch tool breakdown
    const { rows: tools } = await query(`
      SELECT tool_name, call_count
      FROM sync_session_tools
      WHERE sync_session_id = $1
      ORDER BY call_count DESC
    `, [row.id]);

    // Fetch file breakdown
    const { rows: files } = await query(`
      SELECT path, edits, additions, deletions
      FROM sync_session_files
      WHERE sync_session_id = $1
      ORDER BY edits DESC
    `, [row.id]);

    return NextResponse.json({
      id: row.session_id || row.id,
      source: row.source,
      agent: row.agent,
      label: row.label,
      model: row.model,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      syncedAt: row.synced_at,
      intelligence: {
        edits: row.edits,
        additions: row.additions,
        deletions: row.deletions,
        changedLines: row.changed_lines,
        filesTouched: row.files_touched,
        toolCalls: row.tool_calls,
        toolErrors: row.tool_errors,
        reworkLoops: row.rework_loops,
        corrections: row.corrections,
        abandoned: row.abandoned,
        apiCost: row.api_cost,
      },
      stats: {
        tokensIn: Number(row.tokens_in),
        tokensOut: Number(row.tokens_out),
        tokensCacheRead: Number(row.tokens_cache_read),
        tokensCacheWrite: Number(row.tokens_cache_write),
      },
      tools,
      files,
      events: [], // Not stored in DB — show empty for now
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
