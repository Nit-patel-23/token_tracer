/**
 * Team statistics queries and member management.
 */
import { query } from './db';
import { generateApiKey, hashApiKey } from './auth';

interface DateWindow {
  from?: string | null;
  to?: string | null;
}

/**
 * Team rollup stats for admin dashboard.
 */
export async function buildTeamStats(teamId: string, { from = null, to = null }: DateWindow = {}) {
  const params: unknown[] = [teamId];
  let dateFilter = '';
  if (from) {
    params.push(from);
    dateFilter += ` AND COALESCE(s.ended_at, s.started_at, s.synced_at)::date >= $${params.length}::date`;
  }
  if (to) {
    params.push(to);
    dateFilter += ` AND COALESCE(s.ended_at, s.started_at, s.synced_at)::date <= $${params.length}::date`;
  }

  const { rows: members } = await query(
    `SELECT m.id, m.display_name, m.role, m.created_at,
            (SELECT max(created_at) FROM ingest_events e WHERE e.member_id = m.id) AS last_sync_at
     FROM members m WHERE m.team_id = $1 ORDER BY m.display_name`,
    [teamId],
  );

  const { rows: memberStats } = await query(
    `SELECT m.id AS member_id, m.display_name,
            count(s.id)::int AS sessions,
            coalesce(sum(s.edits), 0)::int AS edits,
            coalesce(sum(s.changed_lines), 0)::int AS changed_lines,
            coalesce(sum(s.tool_calls), 0)::int AS tool_calls,
            coalesce(sum(s.tool_errors), 0)::int AS tool_errors,
            coalesce(sum(s.tokens_in), 0)::bigint AS tokens_in,
            coalesce(sum(s.tokens_out), 0)::bigint AS tokens_out,
            coalesce(sum(s.api_cost), 0)::float AS api_cost,
            coalesce(sum(CASE WHEN s.priced THEN 1 ELSE 0 END), 0)::int AS priced_sessions
     FROM members m
     LEFT JOIN sync_sessions s ON s.member_id = m.id AND s.team_id = m.team_id ${dateFilter.replaceAll('s.', 's.')}
     WHERE m.team_id = $1
     GROUP BY m.id, m.display_name
     ORDER BY edits DESC, sessions DESC`,
    params,
  );

  const { rows: bySource } = await query(
    `SELECT s.source,
            count(*)::int AS sessions,
            coalesce(sum(s.edits), 0)::int AS edits,
            coalesce(sum(s.api_cost), 0)::float AS api_cost
     FROM sync_sessions s
     WHERE s.team_id = $1 ${dateFilter}
     GROUP BY s.source ORDER BY edits DESC`,
    params,
  );

  const { rows: byDay } = await query(
    `SELECT to_char(COALESCE(s.ended_at, s.started_at, s.synced_at)::date, 'YYYY-MM-DD') AS date,
            count(*)::int AS sessions,
            coalesce(sum(s.edits), 0)::int AS edits,
            coalesce(sum(s.api_cost), 0)::float AS api_cost
     FROM sync_sessions s
     WHERE s.team_id = $1 ${dateFilter}
     GROUP BY 1 ORDER BY 1`,
    params,
  );

  const { rows: topTools } = await query(
    `SELECT t.tool_name AS name, sum(t.call_count)::int AS count
     FROM sync_session_tools t
     JOIN sync_sessions s ON s.id = t.sync_session_id
     WHERE s.team_id = $1 ${dateFilter}
     GROUP BY t.tool_name ORDER BY count DESC LIMIT 20`,
    params,
  );

  const { rows: topFiles } = await query(
    `SELECT f.path, sum(f.edits)::int AS edits, sum(f.additions + f.deletions)::int AS changed_lines
     FROM sync_session_files f
     JOIN sync_sessions s ON s.id = f.sync_session_id
     WHERE s.team_id = $1 ${dateFilter}
     GROUP BY f.path ORDER BY changed_lines DESC LIMIT 20`,
    params,
  );

  const totals = memberStats.reduce(
    (acc, r) => ({
      sessions: acc.sessions + r.sessions,
      edits: acc.edits + r.edits,
      changedLines: acc.changedLines + Number(r.changed_lines),
      toolCalls: acc.toolCalls + r.tool_calls,
      toolErrors: acc.toolErrors + r.tool_errors,
      tokensIn: acc.tokensIn + Number(r.tokens_in),
      tokensOut: acc.tokensOut + Number(r.tokens_out),
      apiCost: acc.apiCost + Number(r.api_cost),
    }),
    { sessions: 0, edits: 0, changedLines: 0, toolCalls: 0, toolErrors: 0, tokensIn: 0, tokensOut: 0, apiCost: 0 },
  );

  return { window: { from: from ?? null, to: to ?? null }, members, leaderboard: memberStats, bySource, byDay, topTools, topFiles, totals };
}

/** Create a member + API key for an existing team. */
export async function createMemberWithKey(teamId: string, displayName: string, role = 'member') {
  const { rows: memberRows } = await query(
    'INSERT INTO members (team_id, display_name, role) VALUES ($1, $2, $3) RETURNING id, display_name, role',
    [teamId, displayName, role],
  );
  const member = memberRows[0];
  const apiKey = generateApiKey();
  await query(
    'INSERT INTO member_keys (member_id, key_hash, label) VALUES ($1, $2, $3)',
    [member.id, hashApiKey(apiKey), 'default'],
  );
  return { member, apiKey };
}
