import { NextRequest, NextResponse } from 'next/server';
import pg from 'pg';
import { getSessionFromCookie } from '@/lib/auth';
import { requireDatabaseUrl } from '@/lib/team/env';
import { classifyIntent, extractEditOperations, calculateCosineSimilarity } from '@/lib/team/research';

export const dynamic = 'force-dynamic';

const { Pool } = pg;

// Define a local database pool inside this module context
let localPool: pg.Pool | null = null;

function getLocalPool(): pg.Pool {
  if (!localPool) {
    let url = requireDatabaseUrl();
    url = url.replace(/[\?&]sslmode=[^&]+/g, '');
    localPool = new Pool({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      max: 10,
      connectionTimeoutMillis: 20000,
      idleTimeoutMillis: 30000,
    });
    // Set synchronous_commit to OFF to prevent SyncRep hangs on cloud databases
    localPool.on('connect', (client) => {
      client.query('SET synchronous_commit TO OFF').catch((err) => {
        console.warn('Failed to set synchronous_commit:', err.message);
      });
    });
  }
  return localPool;
}

async function localQuery<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<pg.QueryResult<T>> {
  return getLocalPool().query<T>(text, params);
}

async function localSaveSessionTurns(
  teamId: string,
  memberId: string,
  source: string,
  model: string,
  sessionId: string,
  events: any[]
): Promise<void> {
  if ((globalThis as any).abortBackfill) {
    throw new Error('Backfill aborted');
  }
  const isFallback = !events || !events.length;
  let turnsList = events;
  if (!Array.isArray(turnsList) || !turnsList.length) {
    const mockPromptText = `[Trajectory Sync] Workspace interaction via ${source || 'Daemon'} (No event logging payload)`;
    turnsList = [
      { ts: Date.now() - 1000, kind: 'user', text: mockPromptText },
      { ts: Date.now(), kind: 'assistant', text: '[Trajectory Sync] Completion generated.' }
    ];
  }

  // Clean old turns for idempotency
  await localQuery('DELETE FROM session_turns WHERE session_id = $1', [sessionId]);

  // Group events into turns starting with each user message
  const turns: any[] = [];
  let currentTurn: any = null;

  for (const ev of turnsList) {
    if (!ev) continue;
    if (ev.kind === 'user') {
      currentTurn = {
        userEvent: ev,
        assistantEvent: null,
        tools: [],
        thinkings: []
      };
      turns.push(currentTurn);
    } else if (currentTurn) {
      if (ev.kind === 'assistant') {
        currentTurn.assistantEvent = ev;
      } else if (ev.kind === 'tool') {
        currentTurn.tools.push(ev);
      } else if (ev.kind === 'thinking') {
        currentTurn.thinkings.push(ev);
      }
    }
  }

  // Fetch session totals for allocation if turn-level usage is missing/null
  const { rows: sessionInfo } = await localQuery(
    `SELECT 
      tokens_in, tokens_out, tool_calls, tool_errors, 
      rework_loops, corrections, additions, deletions, 
      files_touched, changed_lines 
     FROM sync_sessions WHERE session_id = $1`,
    [sessionId]
  );
  const sessionTokensIn = sessionInfo[0]?.tokens_in || 0;
  const sessionTokensOut = sessionInfo[0]?.tokens_out || 0;
  const sessionToolCalls = sessionInfo[0]?.tool_calls || 0;
  const sessionToolErrors = sessionInfo[0]?.tool_errors || 0;
  const sessionReworkLoops = sessionInfo[0]?.rework_loops || 0;
  const sessionAdditions = sessionInfo[0]?.additions || 0;
  const sessionDeletions = sessionInfo[0]?.deletions || 0;
  const sessionFilesTouched = sessionInfo[0]?.files_touched || 0;

  let totalPromptWeight = 0;
  let totalResponseWeight = 0;
  const promptWeights = turns.map(t => {
    const w = (t.userEvent?.text || '').length;
    totalPromptWeight += w;
    return w;
  });
  const responseWeights = turns.map(t => {
    const txtLen = (t.assistantEvent?.text || '').length;
    const toolCallCount = t.tools?.length || 0;
    const w = txtLen + toolCallCount * 250;
    totalResponseWeight += w;
    return w;
  });

  const previouslyEditedFiles = new Set<string>();
  let cumulativeInputTokens = 0;

  for (let idx = 0; idx < turns.length; idx++) {
    const t = turns[idx];
    const userText = t.userEvent.text || '';
    
    // Performance optimization: slice long userText to prevent regex catastrophic backtracking
    const userTextForRegex = userText.slice(0, 5000);
    
    // Feature extraction from user prompt
    const hasCodeBlock = /```[\s\S]*?```/.test(userTextForRegex);
    const hasFilePath = /(?:[a-zA-Z0-9_\-]+\/)+[a-zA-Z0-9_\.\-]+|[a-zA-Z0-9_\-]+\.(?:ts|tsx|js|jsx|py|json|yml|yaml|css|html|md|rs|go|sh|sql)/i.test(userTextForRegex);
    const hasTraceback = /\b(traceback|stack trace|at [a-zA-Z0-9_\-\.\/]+\:\d+|exception|uncaught|nullpointer|indexoutofbound)\b/i.test(userTextForRegex);
    const intentCategory = classifyIntent(userTextForRegex);
    const userRevert = /\b(revert|undo|go back|reset)\b/i.test(userTextForRegex);

    // Turn 1: Save User Turn Row
    await localQuery(
      `INSERT INTO session_turns (
        session_id, org_id, user_id, tool, model, turn_index, turn_role,
        prompt_text_sanitized, prompt_char_len, has_code_block, has_file_path, has_traceback,
        intent_category, revert_flag
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        sessionId, teamId, memberId, source, model, idx, 'user',
        userText, userText.length, hasCodeBlock, hasFilePath, hasTraceback,
        intentCategory, userRevert
      ]
    );

    // Extract stats from assistant response & tool calls
    const usage = t.assistantEvent?.usage;
    let inputTokens = Number(usage?.tokensIn ?? usage?.input ?? 0);
    let outputTokens = Number(usage?.tokensOut ?? usage?.output ?? 0);
    const cacheRead = Number(usage?.cacheRead ?? usage?.cacheReadTokens ?? 0);
    const cacheWrite = Number(usage?.cacheWrite ?? 0);

    // Fallback: Allocate session tokens proportionally if turn-level usage is null/0
    if (inputTokens === 0 && outputTokens === 0) {
      inputTokens = totalPromptWeight > 0 
        ? Math.round((promptWeights[idx] / totalPromptWeight) * sessionTokensIn)
        : Math.round(sessionTokensIn / Math.max(1, turns.length));
      
      outputTokens = totalResponseWeight > 0
        ? Math.round((responseWeights[idx] / totalResponseWeight) * sessionTokensOut)
        : Math.round(sessionTokensOut / Math.max(1, turns.length));
    }

    cumulativeInputTokens += inputTokens;

    // Process tool edits
    let filesTouchedInTurn = new Set<string>();
    let linesAdded = 0;
    let linesRemoved = 0;
    let toolErrors = 0;
    let turnRevert = userRevert;
    let reworkFlag = false;
    let toolCallCount = 0;
    let toolCallValidCount = 0;

    if (isFallback) {
      for (let fIdx = 0; fIdx < sessionFilesTouched; fIdx++) {
        filesTouchedInTurn.add(`mock_file_${fIdx}.txt`);
      }
      linesAdded = sessionAdditions;
      linesRemoved = sessionDeletions;
      toolErrors = sessionToolErrors;
      reworkFlag = sessionReworkLoops > 0;
      turnRevert = sessionReworkLoops > 0 || (sessionInfo[0]?.corrections || 0) > 0;
      toolCallCount = sessionToolCalls;
      toolCallValidCount = sessionFilesTouched;
    } else {
      for (const toolEv of t.tools) {
        if (toolEv.tool?.isError) {
          toolErrors++;
        }
        
        // Git command revert checks
        if (toolEv.tool?.name === 'run_command' || toolEv.tool?.name === 'command') {
          const cmd = String(toolEv.tool?.args?.command || '').toLowerCase();
          if (/\b(checkout|reset|revert)\b/.test(cmd)) {
            turnRevert = true;
          }
        }

        const edits = extractEditOperations(toolEv);
        for (const op of edits) {
          filesTouchedInTurn.add(op.path);
          linesAdded += op.additions;
          linesRemoved += op.deletions;
        }
      }

      // Check Rework: editing a file already touched in a previous turn
      for (const file of filesTouchedInTurn) {
        if (previouslyEditedFiles.has(file)) {
          reworkFlag = true;
        }
        previouslyEditedFiles.add(file);
      }

      toolCallCount = t.tools.length;
      toolCallValidCount = Array.from(filesTouchedInTurn).length; // tools that referenced real files/lines
    }

    // Turn 2: Save Assistant Turn Row
    const { rows: insertedTurn } = await localQuery(
      `INSERT INTO session_turns (
        session_id, org_id, user_id, tool, model, turn_index, turn_role,
        input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cumulative_input_tokens,
        files_touched, lines_added, lines_removed, tool_call_count, tool_call_valid_count,
        tool_error_flag, rework_flag, revert_flag
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING id`,
      [
        sessionId, teamId, memberId, source, model, idx, 'assistant',
        inputTokens, outputTokens, cacheRead, cacheWrite, cumulativeInputTokens,
        filesTouchedInTurn.size, linesAdded, linesRemoved, toolCallCount, toolCallValidCount,
        toolErrors > 0, reworkFlag, turnRevert
      ]
    );

    const turnId = insertedTurn[0]?.id;
    if (turnId) {
      if (isFallback) {
        if (toolErrors > 0) {
          const { rows: toolsUsed } = await localQuery(
            `SELECT tool_name, call_count 
             FROM sync_session_tools 
             WHERE sync_session_id = (
               SELECT id FROM sync_sessions 
               WHERE team_id = $1::uuid AND member_id = $2::uuid AND source = $3 AND session_id = $4
               LIMIT 1
             )`,
            [teamId, memberId, source, sessionId]
          );
          const toolList: string[] = [];
          for (const tRow of toolsUsed) {
            const name = tRow.tool_name || 'unknown';
            const count = Number(tRow.call_count || 1);
            for (let c = 0; c < count; c++) {
              toolList.push(name);
            }
          }
          if (!toolList.length) {
            for (let c = 0; c < toolCallCount; c++) {
              toolList.push('unknown');
            }
          }
          let errorInserted = 0;
          for (const toolName of toolList) {
            if (errorInserted >= toolErrors) break;
            await localQuery(
              `INSERT INTO session_tool_errors (
                turn_id, session_id, org_id, tool, model, tool_name, tool_args_summary, is_error
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
              [
                turnId, sessionId, teamId, source, model, toolName,
                'Mocked tool call from trajectory totals', true
              ]
            );
            errorInserted++;
          }
        }
      } else if (t.tools.length) {
        for (const toolEv of t.tools) {
          if (!toolEv.tool?.isError) continue;
          const toolName = String(toolEv.tool?.name ?? 'unknown');
          await localQuery(
            `INSERT INTO session_tool_errors (
              turn_id, session_id, org_id, tool, model, tool_name, tool_args_summary, is_error
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              turnId, sessionId, teamId, source, model, toolName,
              'Ingested tool error', true
            ]
          );
        }
      }
    }

    // ── Pilot reprompt similarity checks (Study 5) ──
    const pilotOrgId = process.env.ENABLE_REPROMPT_ANALYSIS_ORG_ID;
    if (pilotOrgId && teamId === pilotOrgId && idx > 0) {
      const prevUserText = turns[idx - 1].userEvent?.text || '';
      const similarity = calculateCosineSimilarity(prevUserText, userText);
      
      if (similarity >= 0.85) {
        await localQuery(
          `INSERT INTO redundant_reprompt_events (session_id, turn_index, similarity_score, tokens_cost_of_following_turn)
           VALUES ($1, $2, $3, $4)`,
          [sessionId, idx, similarity, inputTokens + outputTokens]
        );
      }
    }
  }
}

async function localRunResearchRollup(): Promise<void> {
  // Aggregate turns into session outcomes
  await localQuery(`
    INSERT INTO session_outcomes (
      session_id, org_id, tool, model, intent_category,
      total_input_tokens, total_output_tokens, total_cost,
      files_touched, lines_changed, tool_call_count,
      had_rework, had_revert, had_tool_error, success
    )
    SELECT 
      st.session_id,
      st.org_id,
      st.tool,
      st.model,
      (SELECT intent_category FROM session_turns WHERE session_id = st.session_id AND intent_category IS NOT NULL LIMIT 1) AS intent_category,
      SUM(st.input_tokens)::int AS total_input_tokens,
      SUM(st.output_tokens)::int AS total_output_tokens,
      COALESCE(ss.api_cost, 0)::numeric(12,4) AS total_cost,
      COALESCE((SELECT COUNT(DISTINCT path)::int FROM sync_session_files WHERE sync_session_id = ss.id), 0) AS files_touched,
      SUM(st.lines_added + st.lines_removed)::int AS lines_changed,
      SUM(st.tool_call_count)::int AS tool_call_count,
      BOOL_OR(st.rework_flag) AS had_rework,
      BOOL_OR(st.revert_flag) AS had_revert,
      BOOL_OR(st.tool_error_flag) AS had_tool_error,
      NOT (BOOL_OR(st.rework_flag) OR BOOL_OR(st.revert_flag) OR BOOL_OR(st.tool_error_flag)) AS success
    FROM session_turns st
    LEFT JOIN sync_sessions ss ON ss.session_id = st.session_id
                              AND ss.team_id::text = st.org_id
                              AND ss.member_id::text = st.user_id
                              AND ss.source = st.tool
    GROUP BY st.session_id, st.org_id, st.tool, st.model, ss.id, ss.api_cost
    ON CONFLICT (session_id) DO UPDATE SET
      org_id = EXCLUDED.org_id,
      tool = EXCLUDED.tool,
      model = EXCLUDED.model,
      intent_category = EXCLUDED.intent_category,
      total_input_tokens = EXCLUDED.total_input_tokens,
      total_output_tokens = EXCLUDED.total_output_tokens,
      total_cost = EXCLUDED.total_cost,
      files_touched = EXCLUDED.files_touched,
      lines_changed = EXCLUDED.lines_changed,
      tool_call_count = EXCLUDED.tool_call_count,
      had_rework = EXCLUDED.had_rework,
      had_revert = EXCLUDED.had_revert,
      had_tool_error = EXCLUDED.had_tool_error,
      success = EXCLUDED.success
  `);

  // Calculate task complexity scores
  await localQuery(`
    WITH stats AS (
      SELECT 
        AVG(files_touched)::float AS avg_files,
        COALESCE(NULLIF(STDDEV(files_touched)::float, 0), 1) AS stddev_files,
        AVG(lines_changed)::float AS avg_lines,
        COALESCE(NULLIF(STDDEV(lines_changed)::float, 0), 1) AS stddev_lines,
        AVG(tool_call_count)::float AS avg_tools,
        COALESCE(NULLIF(STDDEV(tool_call_count)::float, 0), 1) AS stddev_tools
      FROM session_outcomes
    )
    UPDATE session_outcomes
    SET complexity_score = (
      (files_touched - (SELECT avg_files FROM stats)) / (SELECT stddev_files FROM stats) +
      (lines_changed - (SELECT avg_lines FROM stats)) / (SELECT stddev_lines FROM stats) +
      (tool_call_count - (SELECT avg_tools FROM stats)) / (SELECT stddev_tools FROM stats)
    );
  `);
}

async function localBackfillResearchAnalytics(limit?: number, offset?: number): Promise<{ processed: number }> {
  const statusObj = (globalThis as any).backfillStatus || { state: 'running', processed: 0, total: 0, error: null };
  (globalThis as any).backfillStatus = statusObj;

  // If a specific limit and offset are passed, run just that batch
  if (limit !== undefined) {
    const { rows } = await localQuery(`
      SELECT team_id::text AS org_id, member_id::text AS user_id, source AS tool, model, session_id, events
      FROM sync_sessions
      ORDER BY id
      LIMIT $1 OFFSET $2
    `, [limit, offset || 0]);
    statusObj.total = rows.length;
    let processed = 0;
    for (const row of rows) {
      if ((globalThis as any).abortBackfill) {
        statusObj.state = 'aborted';
        throw new Error('Backfill aborted');
      }
      let parsedEvents: any[] = [];
      try {
        if (typeof row.events === 'string') {
          parsedEvents = JSON.parse(row.events);
        } else if (Array.isArray(row.events)) {
          parsedEvents = row.events;
        }
      } catch {
        continue;
      }
      try {
        await localSaveSessionTurns(
          row.org_id || 'unknown_org',
          row.user_id || 'unknown_member',
          row.tool || 'cursor',
          row.model || 'default',
          row.session_id,
          parsedEvents
        );
      } catch (saveErr: any) {
        console.warn(`[BACKFILL-SESSION-FAILED] ${row.session_id}:`, saveErr.message);
        continue;
      }
      processed++;
      statusObj.processed = processed;
    }
    await localRunResearchRollup();
    return { processed };
  }

  // Otherwise, run paginated backfill over ALL sessions
  const { rows: countRows } = await localQuery('SELECT COUNT(*)::int AS count FROM sync_sessions');
  const totalSessions = countRows[0]?.count || 0;
  statusObj.total = totalSessions;

  let processed = 0;
  let pageOffset = 0;
  const pageSize = 50;

  while (true) {
    const { rows } = await localQuery(`
      SELECT team_id::text AS org_id, member_id::text AS user_id, source AS tool, model, session_id, events
      FROM sync_sessions
      ORDER BY id
      LIMIT $1 OFFSET $2
    `, [pageSize, pageOffset]);

    if (rows.length === 0) break;

    for (const row of rows) {
      if ((globalThis as any).abortBackfill) {
        statusObj.state = 'aborted';
        throw new Error('Backfill aborted');
      }
      let parsedEvents: any[] = [];
      try {
        if (typeof row.events === 'string') {
          parsedEvents = JSON.parse(row.events);
        } else if (Array.isArray(row.events)) {
          parsedEvents = row.events;
        }
      } catch {
        continue;
      }
      try {
        await localSaveSessionTurns(
          row.org_id || 'unknown_org',
          row.user_id || 'unknown_member',
          row.tool || 'cursor',
          row.model || 'default',
          row.session_id,
          parsedEvents
        );
      } catch (saveErr: any) {
        console.warn(`[BACKFILL-SESSION-FAILED] ${row.session_id}:`, saveErr.message);
        continue;
      }
      processed++;
      statusObj.processed = processed;
    }
    pageOffset += pageSize;
  }

  await localRunResearchRollup();
  statusObj.state = 'completed';
  return { processed };
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const kill = searchParams.get('kill');
    const status = searchParams.get('status');
    
    if (status !== null) {
      const { rows: activity } = await localQuery(`
        SELECT pid, state, query, age(query_start) AS age, wait_event_type, wait_event
        FROM pg_stat_activity 
        WHERE datname = current_database() AND pid <> pg_backend_pid()
      `);
      const { rows: triggers } = await localQuery(`
        SELECT tgname, tgenabled, pg_get_triggerdef(oid) as definition
        FROM pg_trigger 
        WHERE tgrelid = 'session_turns'::regclass
      `);
      return NextResponse.json({
        ok: true,
        activity,
        triggers,
        backfillStatus: (globalThis as any).backfillStatus || null
      });
    }
    
    if (kill !== null) {
      (globalThis as any).abortBackfill = true;
      if ((globalThis as any).backfillStatus) {
        (globalThis as any).backfillStatus.state = 'aborted';
      }
      if (localPool) {
        try { await localPool.end(); } catch {}
        localPool = null;
      }
      const { rows } = await localQuery(`
        SELECT pid, state, query, pg_terminate_backend(pid) AS terminated
        FROM pg_stat_activity 
        WHERE (query LIKE '%session_turns%' OR query LIKE '%sync_sessions%' OR query LIKE '%session_outcomes%' OR state = 'idle in transaction') 
          AND pid <> pg_backend_pid()
      `);
      return NextResponse.json({ ok: true, terminatedQueries: rows });
    }

    const background = searchParams.get('background');
    if (background !== null) {
      (globalThis as any).abortBackfill = false;
      (globalThis as any).backfillStatus = { state: 'running', processed: 0, total: 0, error: null };
      
      localBackfillResearchAnalytics().then((stats) => {
        console.log('[RESEARCH-BACKFILL-DONE]', stats);
      }).catch((err) => {
        console.error('[RESEARCH-BACKFILL-FAILED]', err);
        if ((globalThis as any).backfillStatus) {
          (globalThis as any).backfillStatus.state = 'failed';
          (globalThis as any).backfillStatus.error = err.message;
        }
      });
      return NextResponse.json({
        ok: true,
        message: 'Backfill started in background'
      });
    }
    
    const batch = searchParams.get('batch');
    const sizeStr = searchParams.get('size');
    const size = sizeStr !== null ? Number(sizeStr) : 10;
    
    let processed = 0;
    if (batch !== null) {
      (globalThis as any).abortBackfill = false;
      const limit = size;
      const offset = Number(batch) * size;
      const backfillStats = await localBackfillResearchAnalytics(limit, offset);
      processed = backfillStats.processed;
    }
    
    const { rows: sumSyncErrors } = await localQuery('SELECT SUM(tool_errors)::int AS count FROM sync_sessions');
    const { rows: countToolErrors } = await localQuery('SELECT COUNT(*)::int AS count FROM session_tool_errors WHERE is_error = true');
    const { rows: turnsCount } = await localQuery('SELECT COUNT(*)::int AS count FROM session_turns');
    const { rows: outcomesCount } = await localQuery('SELECT COUNT(*)::int AS count FROM session_outcomes');
    
    return NextResponse.json({
      ok: true,
      batch: batch !== null ? Number(batch) : 'none',
      processed,
      sumSyncErrors: sumSyncErrors[0]?.count,
      countToolErrors: countToolErrors[0]?.count,
      turnsCount: turnsCount[0]?.count,
      outcomesCount: outcomesCount[0]?.count,
      backfillStatus: (globalThis as any).backfillStatus || null
    });
  } catch (err: any) {
    console.error('[admin/migrate GET error]', err);
    return NextResponse.json({
      ok: false,
      error: err.message,
      stack: err.stack
    });
  }
}
