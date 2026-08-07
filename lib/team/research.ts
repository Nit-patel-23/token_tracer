import { query } from './db';

const EDIT_TOOLS = new Set([
  'edit', 'write', 'notebookedit', 'str_replace_editor', 'apply_patch', 'multiedit'
]);

function lineCount(str: string): number {
  if (!str) return 0;
  return str.split('\n').length;
}

function stringEdit(path: string, oldText: string, newText: string) {
  const p = String(path || '');
  return [{ path: p, additions: lineCount(newText), deletions: lineCount(oldText) }];
}

function parsePatch(patch: string) {
  const edits: Array<{ path: string; additions: number; deletions: number }> = [];
  const lines = patch.split('\n');
  let currentFile = '';
  let additions = 0;
  let deletions = 0;
  for (const line of lines) {
    if (line.startsWith('--- a/')) {
      // ignore
    } else if (line.startsWith('+++ b/')) {
      if (currentFile && (additions > 0 || deletions > 0)) {
        edits.push({ path: currentFile, additions, deletions });
      }
      currentFile = line.substring(6).trim();
      additions = 0;
      deletions = 0;
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
      additions++;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      deletions++;
    }
  }
  if (currentFile && (additions > 0 || deletions > 0)) {
    edits.push({ path: currentFile, additions, deletions });
  }
  return edits;
}

export function extractEditOperations(ev: any) {
  if (ev?.kind !== 'tool') return [];
  const name = String(ev.tool?.name ?? '').toLowerCase();
  const args = ev.tool?.args ?? {};
  
  const patch = args.patch ?? args.patch_text ?? args.diff ?? '';
  if (patch && (name === 'apply_patch' || patch.includes('+++ b/'))) {
    return parsePatch(patch);
  }
  if (!EDIT_TOOLS.has(name)) return [];

  const p = args.file_path ?? args.path ?? args.notebook_path ?? args.file;
  if (name === 'multiedit' || Array.isArray(args.edits)) {
    return (args.edits ?? []).flatMap((edit: any) => 
      stringEdit(p, edit.old_string ?? edit.old_str ?? '', edit.new_string ?? edit.new_str ?? '')
    );
  }
  if (name === 'write') return stringEdit(p, '', args.content ?? args.file_text ?? args.text ?? '');
  if (name === 'notebookedit') return stringEdit(p, args.old_source ?? '', args.new_source ?? args.source ?? '');
  if (name === 'str_replace_editor') {
    const command = String(args.command ?? '').toLowerCase();
    if (command === 'create') return stringEdit(p, '', args.file_text ?? args.new_str ?? '');
    if (command === 'insert') return stringEdit(p, '', args.new_str ?? args.text ?? '');
    return stringEdit(p, args.old_str ?? args.old_string ?? '', args.new_str ?? args.new_string ?? '');
  }
  return stringEdit(p, args.old_string ?? args.old_str ?? '', args.new_string ?? args.new_str ?? args.content ?? '');
}

/**
 * Classifies prompt intent category using regex rules
 */
export function classifyIntent(text: string): string {
  const t = text.toLowerCase();
  if (/\b(fix|bug|error|issue|crash|fail|broken|prevent|resolve|bugfix|exception)\b/i.test(t)) return 'bug_fix';
  if (/\b(add|implement|create|new|feature|build|support|newfeature)\b/i.test(t)) return 'feature';
  if (/\b(refactor|clean|cleanup|rename|move|simplify|optimize|structure|restructure)\b/i.test(t)) return 'refactor';
  if (/\b(explain|why|what|how|understand|read|question|describe|help)\b/i.test(t)) return 'explain';
  if (/\b(test|tests|coverage|pytest|jest|unittest|spec|specs|testing)\b/i.test(t)) return 'test';
  return 'other';
}

/**
 * Parses events from a trajectory and populates turn-level stats into session_turns
 */
export async function saveSessionTurns(
  teamId: string,
  memberId: string,
  source: string,
  model: string,
  sessionId: string,
  events: any[]
): Promise<void> {
  let turnsList = events;
  if (!Array.isArray(turnsList) || !turnsList.length) {
    const mockPromptText = `[Trajectory Sync] Workspace interaction via ${source || 'Daemon'} (No event logging payload)`;
    turnsList = [
      { ts: Date.now() - 1000, kind: 'user', text: mockPromptText },
      { ts: Date.now(), kind: 'assistant', text: '[Trajectory Sync] Completion generated.' }
    ];
  }

  // Clean old turns for idempotency
  await query('DELETE FROM session_turns WHERE session_id = $1', [sessionId]);

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
  const { rows: sessionInfo } = await query(
    'SELECT tokens_in, tokens_out FROM sync_sessions WHERE session_id = $1',
    [sessionId]
  );
  const sessionTokensIn = sessionInfo[0]?.tokens_in || 0;
  const sessionTokensOut = sessionInfo[0]?.tokens_out || 0;

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
    
    // Feature extraction from user prompt
    const hasCodeBlock = /```[\s\S]*?```/.test(userText);
    const hasFilePath = /(?:[a-zA-Z0-9_\-]+\/)+[a-zA-Z0-9_\.\-]+|[a-zA-Z0-9_\-]+\.(?:ts|tsx|js|jsx|py|json|yml|yaml|css|html|md|rs|go|sh|sql)/i.test(userText);
    const hasTraceback = /\b(traceback|stack trace|at [a-zA-Z0-9_\-\.\/]+\:\d+|exception|uncaught|nullpointer|indexoutofbound)\b/i.test(userText);
    const intentCategory = classifyIntent(userText);
    const userRevert = /\b(revert|undo|go back|reset)\b/i.test(userText);

    // Turn 1: Save User Turn Row
    await query(
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
    let reworkFlag = false;
    for (const file of filesTouchedInTurn) {
      if (previouslyEditedFiles.has(file)) {
        reworkFlag = true;
      }
      previouslyEditedFiles.add(file);
    }

    const toolCallCount = t.tools.length;
    const toolCallValidCount = Array.from(filesTouchedInTurn).length; // tools that referenced real files/lines

    // Turn 2: Save Assistant Turn Row
    const { rows: insertedTurn } = await query(
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

    // ── Pilot reprompt similarity checks (Study 5) ──
    const pilotOrgId = process.env.ENABLE_REPROMPT_ANALYSIS_ORG_ID;
    if (pilotOrgId && teamId === pilotOrgId && idx > 0) {
      const prevUserText = turns[idx - 1].userEvent?.text || '';
      const similarity = calculateCosineSimilarity(prevUserText, userText);
      
      if (similarity >= 0.85) {
        await query(
          `INSERT INTO redundant_reprompt_events (session_id, turn_index, similarity_score, tokens_cost_of_following_turn)
           VALUES ($1, $2, $3, $4)`,
          [sessionId, idx, similarity, inputTokens + outputTokens]
        );
      }
    }
  }
}

function getTokens(text: string): string[] {
  return text.toLowerCase().match(/\b\w+\b/g) || [];
}

export function calculateCosineSimilarity(text1: string, text2: string): number {
  const tokens1 = getTokens(text1);
  const tokens2 = getTokens(text2);

  if (!tokens1.length || !tokens2.length) return 0;

  const freq1: Record<string, number> = {};
  const freq2: Record<string, number> = {};
  const allWords = new Set<string>();

  for (const w of tokens1) {
    freq1[w] = (freq1[w] || 0) + 1;
    allWords.add(w);
  }
  for (const w of tokens2) {
    freq2[w] = (freq2[w] || 0) + 1;
    allWords.add(w);
  }

  let dotProduct = 0;
  let mag1 = 0;
  let mag2 = 0;

  for (const w of allWords) {
    const val1 = freq1[w] || 0;
    const val2 = freq2[w] || 0;
    dotProduct += val1 * val2;
    mag1 += val1 * val1;
    mag2 += val2 * val2;
  }

  if (mag1 === 0 || mag2 === 0) return 0;
  return dotProduct / (Math.sqrt(mag1) * Math.sqrt(mag2));
}

/**
 * Runs nightly calculations to sync session_turns to session_outcomes rollups
 */
export async function runResearchRollup(): Promise<void> {
  // Aggregate turns into session outcomes
  await query(`
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
      COUNT(DISTINCT ft.path)::int AS files_touched,
      SUM(st.lines_added + st.lines_removed)::int AS lines_changed,
      SUM(st.tool_call_count)::int AS tool_call_count,
      BOOL_OR(st.rework_flag) AS had_rework,
      BOOL_OR(st.revert_flag) AS had_revert,
      BOOL_OR(st.tool_error_flag) AS had_tool_error,
      NOT (BOOL_OR(st.rework_flag) OR BOOL_OR(st.revert_flag) OR BOOL_OR(st.tool_error_flag)) AS success
    FROM session_turns st
    LEFT JOIN sync_sessions ss ON ss.session_id = st.session_id
    LEFT JOIN sync_session_files ft ON ft.sync_session_id = ss.id
    GROUP BY st.session_id, st.org_id, st.tool, st.model, ss.api_cost
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
  await query(`
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

/**
 * Parses and backfills all existing trajectories from sync_sessions into session_turns
 */
export async function backfillResearchAnalytics(): Promise<{ processed: number }> {
  // Fetch all sync_sessions to backfill turn analytics
  const { rows } = await query(`
    SELECT team_id::text AS org_id, member_id::text AS user_id, source AS tool, model, session_id, events
    FROM sync_sessions
  `);

  let processed = 0;
  for (const row of rows) {
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

    await saveSessionTurns(
      row.org_id || 'unknown_org',
      row.user_id || 'unknown_member',
      row.tool || 'cursor',
      row.model || 'default',
      row.session_id,
      parsedEvents
    );
    processed++;
  }

  // Run outcome rollups
  await runResearchRollup();

  return { processed };
}
