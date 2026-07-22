/**
 * Session ingest logic — upserts sanitized session summaries for one member.
 */
import { query } from './db';
import { recalculateTeamCosts } from './stats';

interface SessionPayload {
  source: string;
  sessionId: string;
  agent?: string | null;
  model?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  tokensIn?: number;
  tokensOut?: number;
  tokensCacheRead?: number;
  tokensCacheWrite?: number;
  apiCost?: number | null;
  priced?: boolean;
  edits?: number;
  additions?: number;
  deletions?: number;
  changedLines?: number;
  filesTouched?: number;
  toolCalls?: number;
  toolErrors?: number;
  reworkLoops?: number;
  corrections?: number;
  abandoned?: boolean;
  payloadHash: string;
  tools?: Array<{ name: string; count: number }>;
  files?: Array<{ path: string; edits?: number; additions?: number; deletions?: number }>;
}

interface Member {
  member_id: string;
  team_id: string;
}

/**
 * Upsert sanitized session payloads for one member.
 * @returns {{ accepted: number, total: number }}
 */
export async function ingestSessions(
  member: Member,
  sessions: SessionPayload[],
): Promise<{ accepted: number; total: number }> {
  if (!Array.isArray(sessions) || !sessions.length) {
    return { accepted: 0, total: 0 };
  }

  let accepted = 0;
  for (const item of sessions) {
    const s = item as Record<string, any>;
    const source = String(s.source || 'cursor');
    const sessionId = String(s.sessionId || s.id || s.session_id || `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
    const model = String(s.model || 'default');

    let tokensIn = Number(s.tokensIn ?? s.tokens_in ?? 0);
    let tokensOut = Number(s.tokensOut ?? s.tokens_out ?? 0);
    const edits = Number(s.edits || 0);
    const toolCalls = Number(s.toolCalls || s.tool_calls || 0);
    const changedLines = Number(s.changedLines || s.changed_lines || 0);

    if (tokensIn === 0 && tokensOut === 0 && (edits > 0 || toolCalls > 0 || changedLines > 0)) {
      tokensIn = Math.max(500, (toolCalls + edits) * 350 + changedLines * 10);
      tokensOut = Math.max(200, (toolCalls + edits) * 150 + changedLines * 5);
    }

    const { rows } = await query(
      `INSERT INTO sync_sessions (
        team_id, member_id, source, session_id, agent, label, model,
        started_at, ended_at, tokens_in, tokens_out, tokens_cache_read, tokens_cache_write,
        api_cost, priced, edits, additions, deletions, changed_lines, files_touched,
        tool_calls, tool_errors, rework_loops, corrections, abandoned, payload_hash, synced_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26, now()
      )
      ON CONFLICT (team_id, member_id, source, session_id) DO UPDATE SET
        agent = EXCLUDED.agent,
        model = EXCLUDED.model,
        started_at = EXCLUDED.started_at,
        ended_at = EXCLUDED.ended_at,
        tokens_in = EXCLUDED.tokens_in,
        tokens_out = EXCLUDED.tokens_out,
        tokens_cache_read = EXCLUDED.tokens_cache_read,
        tokens_cache_write = EXCLUDED.tokens_cache_write,
        api_cost = null,
        priced = false,
        edits = EXCLUDED.edits,
        additions = EXCLUDED.additions,
        deletions = EXCLUDED.deletions,
        changed_lines = EXCLUDED.changed_lines,
        files_touched = EXCLUDED.files_touched,
        tool_calls = EXCLUDED.tool_calls,
        tool_errors = EXCLUDED.tool_errors,
        rework_loops = EXCLUDED.rework_loops,
        corrections = EXCLUDED.corrections,
        abandoned = EXCLUDED.abandoned,
        payload_hash = EXCLUDED.payload_hash,
        synced_at = now()
      RETURNING id`,
      [
        member.team_id,
        member.member_id,
        source,
        sessionId,
        s.agent ?? null,
        null,
        model,
        s.startedAt ?? s.started_at ?? null,
        s.endedAt ?? s.ended_at ?? null,
        tokensIn,
        tokensOut,
        Number(s.tokensCacheRead ?? s.tokens_cache_read ?? 0),
        Number(s.tokensCacheWrite ?? s.tokens_cache_write ?? 0),
        null, // Always let server calculate the cost
        false, // Always let server calculate the cost
        edits,
        Number(s.additions || 0),
        Number(s.deletions || 0),
        changedLines,
        Number(s.filesTouched || s.files_touched || 0),
        toolCalls,
        Number(s.toolErrors || s.tool_errors || 0),
        Number(s.reworkLoops || s.rework_loops || 0),
        Number(s.corrections || 0),
        Boolean(s.abandoned),
        s.payloadHash || s.payload_hash || `hash_${Date.now()}_${Math.random()}`,
      ],
    );

    const syncSessionId = rows[0]?.id;
    if (!syncSessionId) continue;
    accepted++;

    await query('DELETE FROM sync_session_tools WHERE sync_session_id = $1', [syncSessionId]);
    await query('DELETE FROM sync_session_files WHERE sync_session_id = $1', [syncSessionId]);

    for (const t of s.tools ?? []) {
      await query(
        'INSERT INTO sync_session_tools (sync_session_id, tool_name, call_count) VALUES ($1, $2, $3)',
        [syncSessionId, t.name, t.count],
      );
    }
    for (const f of s.files ?? []) {
      await query(
        'INSERT INTO sync_session_files (sync_session_id, path, edits, additions, deletions) VALUES ($1, $2, $3, $4, $5)',
        [syncSessionId, f.path, f.edits ?? 0, f.additions ?? 0, f.deletions ?? 0],
      );
    }
  }

  await query(
    'INSERT INTO ingest_events (team_id, member_id, session_count, accepted, status) VALUES ($1, $2, $3, $4, $5)',
    [member.team_id, member.member_id, sessions.length, accepted, 'ok'],
  );

  try {
    await recalculateTeamCosts(member.team_id);
  } catch (err) {
    console.error('[ingest recalculate err]', err);
  }

  return { accepted, total: sessions.length };
}

