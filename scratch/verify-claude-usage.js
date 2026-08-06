#!/usr/bin/env node

/**
 * Script to verify local Claude Code session logs, sum today's token usage,
 * and compare them side-by-side with the database records.
 * Run this directly in your terminal:
 *   node scratch/verify-claude-usage.js
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { Pool } = require('pg');

const CC_SKIP_TYPES = new Set([
  'attachment', 'file-history-snapshot', 'file-history-delta', 'last-prompt',
  'mode', 'permission-mode', 'progress', 'queued-prompt',
]);

// Helper to hash key
function hashApiKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

// ── 1. Read Environment Variables from .env.local ─────────────────────────
let dbUrl = '';
let targetApiKey = 'av_live_PQUiVmW_P7wYp-1trguFxucqwSsF2656'; // Default nit API Key

if (fs.existsSync('.env.local')) {
  const envContent = fs.readFileSync('.env.local', 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('DATABASE_URL=')) {
      dbUrl = trimmed.split('=')[1].trim().replace(/^['"]|['"]$/g, '');
    }
  }
}

if (!dbUrl) {
  console.error('❌ Error: DATABASE_URL not found in .env.local');
  process.exit(1);
}

// ── 2. Parse Local Transcripts ──────────────────────────────────────────────
const searchRoots = [
  process.env.CLAUDE_CONFIG_DIR ? path.join(process.env.CLAUDE_CONFIG_DIR, 'projects') : null,
  path.join(os.homedir(), '.claude', 'projects'),
  path.join(os.homedir(), 'Library', 'Application Support', 'claude', 'projects'),
].filter(Boolean);

const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
console.log(`🔍 Today's Date: ${todayStr}`);
console.log('📂 Scanning local Claude Code session logs...');

function getJsonLines(file) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    return raw.split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
  } catch (err) {
    return [];
  }
}

function sumUsage(stats, usage) {
  if (!usage || typeof usage !== 'object') return;
  const cacheRead = Number(
    usage.cacheRead ??
    usage.cache_read_input_tokens ??
    usage.cacheReadTokens ??
    usage.cache_read_tokens ??
    usage.prompt_tokens_details?.cached_tokens ??
    0
  );
  const cacheWrite = Number(
    usage.cacheWrite ??
    usage.cache_creation_input_tokens ??
    usage.cacheWriteTokens ??
    usage.cache_write_tokens ??
    0
  );
  const rawIn = Number(
    usage.input ??
    usage.input_tokens ??
    usage.inputTokens ??
    usage.prompt_tokens ??
    usage.promptTokens ??
    usage.tokensIn ??
    usage.tokens_in ??
    0
  );
  const rawOut = Number(
    usage.output ??
    usage.output_tokens ??
    usage.outputTokens ??
    usage.completion_tokens ??
    usage.completionTokens ??
    usage.tokensOut ??
    usage.tokens_out ??
    0
  );

  stats.tokensIn += rawIn + cacheRead + cacheWrite;
  stats.tokensOut += rawOut;
  stats.tokensCacheRead += cacheRead;
  stats.tokensCacheWrite += cacheWrite;
}

const matchingFiles = [];
for (const root of searchRoots) {
  if (!fs.existsSync(root)) continue;
  const projects = fs.readdirSync(root);
  for (const proj of projects) {
    const projPath = path.join(root, proj);
    if (!fs.statSync(projPath).isDirectory()) continue;
    const files = fs.readdirSync(projPath);
    for (const file of files) {
      if (!file.endsWith('.jsonl')) continue;
      matchingFiles.push({ filePath: path.join(projPath, file), project: proj });
    }
  }
}

let localIn = 0;
let localOut = 0;
let localCacheRead = 0;
let localSessionsCount = 0;
const localSessionsMap = new Map();

for (const { filePath, project } of matchingFiles) {
  const lines = getJsonLines(filePath);
  if (lines.length === 0) continue;

  let activeToday = false;
  let sessionStats = { tokensIn: 0, tokensOut: 0, tokensCacheRead: 0, tokensCacheWrite: 0 };
  let startedAt = null;
  let title = '(Untitled Session)';
  const sid = path.basename(filePath, '.jsonl');

  for (const obj of lines) {
    const ts = obj.timestamp || obj.message?.timestamp;
    if (ts) {
      const dateStr = new Date(ts).toLocaleDateString('en-CA');
      if (dateStr === todayStr) activeToday = true;
      if (!startedAt || new Date(ts) < new Date(startedAt)) startedAt = ts;
    }
    if (obj.type === 'ai-title' && obj.aiTitle) title = obj.aiTitle;
    else if (obj.type === 'summary' && obj.summary) title = obj.summary;

    if (CC_SKIP_TYPES.has(obj.type)) continue;
    const m = obj.message ?? (obj.role ? obj : null);
    if (m && m.role === 'assistant') {
      sumUsage(sessionStats, m.usage);
    }
  }

  if (activeToday) {
    localSessionsCount++;
    localIn += sessionStats.tokensIn;
    localOut += sessionStats.tokensOut;
    localCacheRead += sessionStats.tokensCacheRead;
    localSessionsMap.set(sid.toLowerCase(), {
      title,
      tokensIn: sessionStats.tokensIn,
      tokensOut: sessionStats.tokensOut,
      cacheRead: sessionStats.tokensCacheRead,
    });
  }
}

// ── 3. Query Postgres Database ──────────────────────────────────────────────
async function runComparison() {
  console.log('\n🗄️ Connecting to database to fetch DB records...');
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Find member by username 'nit'
    const { rows: memberRows } = await pool.query(`
      SELECT u.member_id, u.display_name
      FROM users u
      WHERE u.username = 'nit'
    `);

    if (memberRows.length === 0) {
      console.log(`❌ Error: No user found with username "nit"`);
      return;
    }

    const { member_id: memberId, display_name: displayName } = memberRows[0];
    console.log(`👤 Found Member: "${displayName}" (ID: ${memberId})`);

    // Define approximation logic just in case tokens are 0 in DB
    const effInSql = `CASE WHEN tokens_in = 0 AND (tool_calls+edits) > 0 THEN GREATEST(500, (tool_calls+edits)*350 + changed_lines*10) ELSE tokens_in END`;
    const effOutSql = `CASE WHEN tokens_out = 0 AND (tool_calls+edits) > 0 THEN GREATEST(200, (tool_calls+edits)*150 + changed_lines*5) ELSE tokens_out END`;

    // Query today's sessions in the DB for this member
    const { rows: dbSessions } = await pool.query(`
      SELECT 
        session_id,
        label,
        tokens_in,
        tokens_out,
        tokens_cache_read,
        ${effInSql} AS eff_in,
        ${effOutSql} AS eff_out,
        edits,
        tool_calls,
        synced_at
      FROM sync_sessions
      WHERE member_id = $1
        AND COALESCE(ended_at, started_at, synced_at)::date = CURRENT_DATE
    `, [memberId]);

    console.log(`\n--- Today's Database Records (${dbSessions.length} sessions) ---`);
    let dbTotalIn = 0;
    let dbTotalOut = 0;
    let dbTotalCacheRead = 0;
    let dbTotalEffIn = 0;
    let dbTotalEffOut = 0;

    for (const r of dbSessions) {
      const sidKey = r.session_id.toLowerCase();
      const localMatch = localSessionsMap.get(sidKey);

      console.log(`\n🔑 Session: ${r.session_id}`);
      console.log(`   Label:   ${r.label || localMatch?.title || '(No label)'}`);
      console.log(`   DB Raw:  In: ${r.tokens_in.toLocaleString()} | Out: ${r.tokens_out.toLocaleString()} | Cache: ${r.tokens_cache_read.toLocaleString()}`);
      
      // Print local log values side-by-side if matched
      if (localMatch) {
        console.log(`   Local:   In: ${localMatch.tokensIn.toLocaleString()} | Out: ${localMatch.tokensOut.toLocaleString()} | Cache: ${localMatch.cacheRead.toLocaleString()}`);
        const diffIn = localMatch.tokensIn - r.tokens_in;
        const diffOut = localMatch.tokensOut - r.tokens_out;
        if (diffIn !== 0 || diffOut !== 0) {
          console.log(`   ⚠️ Difference: Input: ${diffIn.toLocaleString()} | Output: ${diffOut.toLocaleString()}`);
        } else {
          console.log(`   ✅ Exact Match!`);
        }
      } else {
        console.log(`   ⚠️ Session not found in today's local log directory (might be from another machine or timezone difference)`);
      }

      dbTotalIn += Number(r.tokens_in);
      dbTotalOut += Number(r.tokens_out);
      dbTotalCacheRead += Number(r.tokens_cache_read);
      dbTotalEffIn += Number(r.eff_in);
      dbTotalEffOut += Number(r.eff_out);
    }

    // ── 4. Comparison Summary ───────────────────────────────────────────────
    console.log('\n============================================================');
    console.log(`📊 GRAND TOTAL COMPARISON FOR TODAY (${todayStr}):`);
    console.log('============================================================');
    console.log(`                    LOCAL LOGS          DATABASE RECORDS`);
    console.log(`Sessions Count:     ${String(localSessionsCount).padEnd(19)} ${dbSessions.length}`);
    console.log(`Input Tokens:       ${localIn.toLocaleString().padEnd(19)} ${dbTotalIn.toLocaleString()}`);
    console.log(`Output Tokens:      ${localOut.toLocaleString().padEnd(19)} ${dbTotalOut.toLocaleString()}`);
    console.log(`Cache Read Tokens:  ${localCacheRead.toLocaleString().padEnd(19)} ${dbTotalCacheRead.toLocaleString()}`);
    
    if (dbTotalIn === 0 && dbTotalEffIn > 0) {
      console.log('\n💡 Note: Raw DB tokens are 0. Using the new SQL token estimation fallback:');
      console.log(`Estimated Input:    -                   ${dbTotalEffIn.toLocaleString()}`);
      console.log(`Estimated Output:   -                   ${dbTotalEffOut.toLocaleString()}`);
    }
    console.log('============================================================\n');

  } catch (err) {
    console.error('❌ Database query failed:', err.message);
  } finally {
    await pool.end();
  }
}

runComparison();
