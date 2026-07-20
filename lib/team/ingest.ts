/**
 * Session ingest logic — upserts sanitized session summaries for one member.
 */
import { query } from './db';

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
  for (const s of sessions) {
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
        api_cost = EXCLUDED.api_cost,
        priced = EXCLUDED.priced,
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
        s.source,
        s.sessionId,
        s.agent ?? null,
        null,
        s.model ?? null,
        s.startedAt ?? null,
        s.endedAt ?? null,
        s.tokensIn ?? 0,
        s.tokensOut ?? 0,
        s.tokensCacheRead ?? 0,
        s.tokensCacheWrite ?? 0,
        s.apiCost ?? null,
        Boolean(s.priced),
        s.edits ?? 0,
        s.additions ?? 0,
        s.deletions ?? 0,
        s.changedLines ?? 0,
        s.filesTouched ?? 0,
        s.toolCalls ?? 0,
        s.toolErrors ?? 0,
        s.reworkLoops ?? 0,
        s.corrections ?? 0,
        Boolean(s.abandoned),
        s.payloadHash,
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

  return { accepted, total: sessions.length };
}
