/**
 * Team statistics queries and member management.
 * Provides deep analytics per member, per project, per agent source, per file,
 * and custom model pricing rates.
 */
import { query } from './db';
import { generateApiKey, hashApiKey } from './auth';

interface StatsOptions {
  from?: string | null;
  to?: string | null;
  memberId?: string | null;
  minTokens?: number | null;
  maxTokens?: number | null;
  source?: string | null;
}

/**
 * Team rollup stats for admin dashboard with per-member, per-project, file-level drilldowns,
 * and custom filter parameters.
 */
export async function buildTeamStats(
  teamId: string,
  { from = null, to = null, memberId = null, minTokens = null, maxTokens = null, source = null }: StatsOptions = {},
) {
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
  if (memberId && memberId !== 'all') {
    params.push(memberId);
    dateFilter += ` AND s.member_id = $${params.length}`;
  }
  if (source && source !== 'all') {
    params.push(source);
    dateFilter += ` AND s.source = $${params.length}`;
  }
  if (minTokens != null && Number(minTokens) > 0) {
    params.push(Number(minTokens));
    dateFilter += ` AND (s.tokens_in + s.tokens_out) >= $${params.length}`;
  }
  if (maxTokens != null && Number(maxTokens) > 0) {
    params.push(Number(maxTokens));
    dateFilter += ` AND (s.tokens_in + s.tokens_out) <= $${params.length}`;
  }

  // 1. Members list
  const { rows: members } = await query(
    `SELECT m.id, m.display_name, m.role, m.created_at,
            (SELECT max(created_at) FROM ingest_events e WHERE e.member_id = m.id) AS last_sync_at
     FROM members m WHERE m.team_id = $1 ORDER BY m.display_name`,
    [teamId],
  );

  // 2. Member leaderboard & aggregate token totals
  const { rows: memberStats } = await query(
    `SELECT m.id AS member_id, m.display_name,
            count(s.id)::int AS sessions,
            coalesce(sum(s.edits), 0)::int AS edits,
            coalesce(sum(s.additions), 0)::int AS additions,
            coalesce(sum(s.deletions), 0)::int AS deletions,
            coalesce(sum(s.changed_lines), 0)::int AS changed_lines,
            coalesce(sum(s.files_touched), 0)::int AS files_touched,
            coalesce(sum(s.tool_calls), 0)::int AS tool_calls,
            coalesce(sum(s.tool_errors), 0)::int AS tool_errors,
            coalesce(sum(s.rework_loops), 0)::int AS rework_loops,
            coalesce(sum(s.corrections), 0)::int AS corrections,
            coalesce(sum(CASE WHEN s.abandoned THEN 1 ELSE 0 END), 0)::int AS abandoned,
            coalesce(sum(s.tokens_in), 0)::bigint AS tokens_in,
            coalesce(sum(s.tokens_out), 0)::bigint AS tokens_out,
            coalesce(sum(s.tokens_cache_read), 0)::bigint AS tokens_cache_read,
            coalesce(sum(s.tokens_cache_write), 0)::bigint AS tokens_cache_write,
            coalesce(sum(s.api_cost), 0)::float AS api_cost,
            coalesce(sum(CASE WHEN s.priced THEN 1 ELSE 0 END), 0)::int AS priced_sessions
     FROM members m
     LEFT JOIN sync_sessions s ON s.member_id = m.id AND s.team_id = m.team_id ${dateFilter}
     WHERE m.team_id = $1 ${memberId && memberId !== 'all' ? `AND m.id = '${memberId}'` : ''}
     GROUP BY m.id, m.display_name
     ORDER BY api_cost DESC, edits DESC, sessions DESC`,
    params,
  );

  // 3. Per-member breakdown by agent source
  const { rows: memberSources } = await query(
    `SELECT s.member_id,
            s.source,
            count(s.id)::int AS sessions,
            coalesce(sum(s.tokens_in), 0)::bigint AS tokens_in,
            coalesce(sum(s.tokens_out), 0)::bigint AS tokens_out,
            coalesce(sum(s.tokens_cache_read), 0)::bigint AS tokens_cache_read,
            coalesce(sum(s.api_cost), 0)::float AS api_cost,
            coalesce(sum(s.edits), 0)::int AS edits,
            coalesce(sum(s.changed_lines), 0)::int AS changed_lines
     FROM sync_sessions s
     WHERE s.team_id = $1 ${dateFilter}
     GROUP BY s.member_id, s.source
     ORDER BY api_cost DESC`,
    params,
  );

  // 4. Per-member breakdown by project / workspace (agent)
  const { rows: memberProjects } = await query(
    `SELECT s.member_id,
            COALESCE(s.agent, 'default') AS project,
            s.source,
            count(s.id)::int AS sessions,
            coalesce(sum(s.tokens_in), 0)::bigint AS tokens_in,
            coalesce(sum(s.tokens_out), 0)::bigint AS tokens_out,
            coalesce(sum(s.tokens_cache_read), 0)::bigint AS tokens_cache_read,
            coalesce(sum(s.api_cost), 0)::float AS api_cost,
            coalesce(sum(s.edits), 0)::int AS edits,
            coalesce(sum(s.changed_lines), 0)::int AS changed_lines,
            max(COALESCE(s.ended_at, s.started_at, s.synced_at)) AS last_activity
     FROM sync_sessions s
     WHERE s.team_id = $1 ${dateFilter}
     GROUP BY s.member_id, COALESCE(s.agent, 'default'), s.source
     ORDER BY api_cost DESC, sessions DESC`,
    params,
  );

  // 5. Per-member top files touched
  const { rows: memberFiles } = await query(
    `SELECT s.member_id,
            f.path,
            sum(f.edits)::int AS edits,
            sum(f.additions)::int AS additions,
            sum(f.deletions)::int AS deletions,
            sum(f.additions + f.deletions)::int AS changed_lines
     FROM sync_session_files f
     JOIN sync_sessions s ON s.id = f.sync_session_id
     WHERE s.team_id = $1 ${dateFilter}
     GROUP BY s.member_id, f.path
     ORDER BY changed_lines DESC`,
    params,
  );

  // 6. Project-level rollup (across the team)
  const { rows: projectRollup } = await query(
    `SELECT COALESCE(s.agent, 'default') AS project,
            count(DISTINCT s.member_id)::int AS member_count,
            count(DISTINCT s.source)::int AS source_count,
            count(s.id)::int AS sessions,
            coalesce(sum(s.tokens_in), 0)::bigint AS tokens_in,
            coalesce(sum(s.tokens_out), 0)::bigint AS tokens_out,
            coalesce(sum(s.tokens_cache_read), 0)::bigint AS tokens_cache_read,
            coalesce(sum(s.api_cost), 0)::float AS api_cost,
            coalesce(sum(s.edits), 0)::int AS edits,
            coalesce(sum(s.changed_lines), 0)::int AS changed_lines,
            max(COALESCE(s.ended_at, s.started_at, s.synced_at)) AS last_activity
     FROM sync_sessions s
     WHERE s.team_id = $1 ${dateFilter}
     GROUP BY COALESCE(s.agent, 'default')
     ORDER BY api_cost DESC, sessions DESC`,
    params,
  );

  // 7. Team-wide source breakdown (Cursor, Claude Code, etc.)
  const { rows: bySource } = await query(
    `SELECT s.source,
            count(*)::int AS sessions,
            count(DISTINCT s.member_id)::int AS member_count,
            coalesce(sum(s.tokens_in), 0)::bigint AS tokens_in,
            coalesce(sum(s.tokens_out), 0)::bigint AS tokens_out,
            coalesce(sum(s.tokens_cache_read), 0)::bigint AS tokens_cache_read,
            coalesce(sum(s.edits), 0)::int AS edits,
            coalesce(sum(s.api_cost), 0)::float AS api_cost
     FROM sync_sessions s
     WHERE s.team_id = $1 ${dateFilter}
     GROUP BY s.source ORDER BY api_cost DESC, edits DESC`,
    params,
  );

  // 8. Daily activity flow
  const { rows: byDay } = await query(
    `SELECT to_char(COALESCE(s.ended_at, s.started_at, s.synced_at)::date, 'YYYY-MM-DD') AS date,
            count(*)::int AS sessions,
            coalesce(sum(s.tokens_in), 0)::bigint AS tokens_in,
            coalesce(sum(s.tokens_out), 0)::bigint AS tokens_out,
            coalesce(sum(s.edits), 0)::int AS edits,
            coalesce(sum(s.api_cost), 0)::float AS api_cost
     FROM sync_sessions s
     WHERE s.team_id = $1 ${dateFilter}
     GROUP BY 1 ORDER BY 1`,
    params,
  );

  // 9. Top tools used team-wide
  const { rows: topTools } = await query(
    `SELECT t.tool_name AS name, sum(t.call_count)::int AS count
     FROM sync_session_tools t
     JOIN sync_sessions s ON s.id = t.sync_session_id
     WHERE s.team_id = $1 ${dateFilter}
     GROUP BY t.tool_name ORDER BY count DESC LIMIT 20`,
    params,
  );

  // 10. Top files team-wide
  const { rows: topFiles } = await query(
    `SELECT f.path,
            sum(f.edits)::int AS edits,
            sum(f.additions)::int AS additions,
            sum(f.deletions)::int AS deletions,
            sum(f.additions + f.deletions)::int AS changed_lines,
            count(DISTINCT s.member_id)::int AS member_count
     FROM sync_session_files f
     JOIN sync_sessions s ON s.id = f.sync_session_id
     WHERE s.team_id = $1 ${dateFilter}
     GROUP BY f.path ORDER BY changed_lines DESC LIMIT 40`,
    params,
  );

  // 11. Recent session log
  const { rows: recentLogs } = await query(
    `SELECT s.id,
            s.source,
            COALESCE(s.agent, 'default') AS project,
            s.model,
            s.member_id,
            m.display_name AS member_name,
            s.tokens_in,
            s.tokens_out,
            s.tokens_cache_read,
            s.api_cost,
            s.edits,
            s.additions,
            s.deletions,
            s.changed_lines,
            s.tool_calls,
            s.tool_errors,
            COALESCE(s.ended_at, s.started_at, s.synced_at) AS timestamp
     FROM sync_sessions s
     JOIN members m ON m.id = s.member_id
     WHERE s.team_id = $1 ${dateFilter}
     ORDER BY timestamp DESC
     LIMIT 50`,
    params,
  );

  // 12. Model Pricing Rates Table
  const { rows: modelPricing } = await query(
    `SELECT id, model_pattern, cost_in_per_m, cost_out_per_m, cost_cache_read_per_m, created_at
     FROM model_pricing WHERE team_id = $1 ORDER BY model_pattern`,
    [teamId],
  );

  const totalTeamTokens = memberStats.reduce(
    (acc, r) => acc + Number(r.tokens_in) + Number(r.tokens_out),
    0,
  );

  // Token Leaderboard
  const tokenLeaderboard = memberStats
    .map((m) => {
      const totalTokens = Number(m.tokens_in) + Number(m.tokens_out);
      const sharePct = totalTeamTokens > 0 ? (totalTokens / totalTeamTokens) * 100 : 0;
      return {
        member_id: m.member_id,
        display_name: m.display_name,
        sessions: m.sessions,
        tokens_in: Number(m.tokens_in),
        tokens_out: Number(m.tokens_out),
        tokens_cache_read: Number(m.tokens_cache_read),
        total_tokens: totalTokens,
        share_pct: sharePct,
        api_cost: m.api_cost,
        edits: m.edits,
      };
    })
    .sort((a, b) => b.total_tokens - a.total_tokens);

  // Head to head scoreboard
  const scoreboard = memberStats.map((m) => {
    const s = Math.max(1, m.sessions);
    const edits = Math.max(1, m.edits);
    const toolCalls = Math.max(1, m.tool_calls);
    const tokensIn = Math.max(1, Number(m.tokens_in));
    const changedLines = Math.max(0.01, m.changed_lines / 100);

    return {
      member_id: m.member_id,
      display_name: m.display_name,
      editsPerSession: m.edits / s,
      outputTokensPerEdit: (Number(m.tokens_in) + Number(m.tokens_out)) / edits,
      toolErrorRate: m.tool_errors / toolCalls,
      cacheEfficiency: Number(m.tokens_cache_read) / tokensIn,
      costPerEdit: m.api_cost / edits,
      costPer100Lines: m.api_cost / changedLines,
    };
  });

  const memberMap = new Map<string, Record<string, unknown>>();
  for (const m of memberStats) {
    memberMap.set(m.member_id, {
      ...m,
      sources: memberSources.filter((s) => s.member_id === m.member_id),
      projects: memberProjects.filter((p) => p.member_id === m.member_id),
      topFiles: memberFiles.filter((f) => f.member_id === m.member_id).slice(0, 10),
    });
  }

  const projects = projectRollup.map((p) => {
    const projProjects = memberProjects.filter((mp) => mp.project === p.project);
    return {
      ...p,
      members: projProjects.map((mp) => {
        const mem = members.find((m) => m.id === mp.member_id);
        return {
          member_id: mp.member_id,
          display_name: mem?.display_name || 'Unknown',
          source: mp.source,
          sessions: mp.sessions,
          tokens_in: mp.tokens_in,
          tokens_out: mp.tokens_out,
          api_cost: mp.api_cost,
          edits: mp.edits,
        };
      }),
    };
  });

  const totals = memberStats.reduce(
    (acc, r) => ({
      sessions: acc.sessions + r.sessions,
      edits: acc.edits + r.edits,
      additions: acc.additions + r.additions,
      deletions: acc.deletions + r.deletions,
      changedLines: acc.changedLines + Number(r.changed_lines),
      filesTouched: acc.filesTouched + r.files_touched,
      toolCalls: acc.toolCalls + r.tool_calls,
      toolErrors: acc.toolErrors + r.tool_errors,
      reworkLoops: acc.reworkLoops + r.rework_loops,
      corrections: acc.corrections + r.corrections,
      abandoned: acc.abandoned + r.abandoned,
      tokensIn: acc.tokensIn + Number(r.tokens_in),
      tokensOut: acc.tokensOut + Number(r.tokens_out),
      tokensCacheRead: acc.tokensCacheRead + Number(r.tokens_cache_read),
      apiCost: acc.apiCost + Number(r.api_cost),
    }),
    {
      sessions: 0,
      edits: 0,
      additions: 0,
      deletions: 0,
      changedLines: 0,
      filesTouched: 0,
      toolCalls: 0,
      toolErrors: 0,
      reworkLoops: 0,
      corrections: 0,
      abandoned: 0,
      tokensIn: 0,
      tokensOut: 0,
      tokensCacheRead: 0,
      apiCost: 0,
    },
  );

  return {
    window: { from: from ?? null, to: to ?? null, memberId: memberId ?? null, minTokens: minTokens ?? null, maxTokens: maxTokens ?? null, source: source ?? null },
    members,
    leaderboard: Array.from(memberMap.values()),
    tokenLeaderboard,
    scoreboard,
    projects,
    bySource,
    byDay,
    topTools,
    topFiles,
    recentLogs,
    modelPricing,
    totals,
  };
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

/** Update a team member's display name or role. */
export async function updateMember(memberId: string, teamId: string, displayName: string, role = 'member') {
  const { rows } = await query(
    'UPDATE members SET display_name = $1, role = $2 WHERE id = $3 AND team_id = $4 RETURNING id, display_name, role',
    [displayName, role, memberId, teamId],
  );
  return rows[0] || null;
}

/** Delete a team member and all associated data. */
export async function deleteMember(memberId: string, teamId: string) {
  const { rowCount } = await query(
    'DELETE FROM members WHERE id = $1 AND team_id = $2',
    [memberId, teamId],
  );
  return { ok: true, deleted: (rowCount || 0) > 0 };
}
