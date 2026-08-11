const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

function matchesModelPattern(modelName, pattern) {
  if (!pattern) return false;
  const regexPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // escape regex chars
    .replace(/\*/g, '.*'); // convert glob stars to regex .*
  return new RegExp(`^${regexPattern}$`, 'i').test(modelName);
}

async function run() {
  const connectionString = 'postgresql://neondb_owner:npg_ZAGKmM7na2bq@ep-soft-resonance-azhtqsdx.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';
  const client = new Client({ connectionString });
  await client.connect();

  try {
    const memberId = 'e9c2aded-64e1-496a-bb4c-503d4a6a647b';
    const teamId = '27da1f96-4c0f-4c6e-94a3-1a96b064a084';

    // Fetch custom pricing rules for this team
    const { rows: customRules } = await client.query(
      `SELECT model_pattern, cost_in_per_m, cost_out_per_m, cost_cache_read_per_m
       FROM model_pricing
       WHERE team_id = $1 OR team_id IS NULL
       ORDER BY (team_id IS NOT NULL) DESC`,
      [teamId]
    );

    const defaultRules = [
      { model_pattern: 'claude-3-7-sonnet', cost_in_per_m: 3.0, cost_out_per_m: 15.0, cost_cache_read_per_m: 0.3 },
      { model_pattern: 'claude-3-5-sonnet', cost_in_per_m: 3.0, cost_out_per_m: 15.0, cost_cache_read_per_m: 0.3 },
      { model_pattern: 'claude-3-5-haiku', cost_in_per_m: 0.8, cost_out_per_m: 4.0, cost_cache_read_per_m: 0.08 },
      { model_pattern: 'gpt-4o', cost_in_per_m: 2.5, cost_out_per_m: 10.0, cost_cache_read_per_m: 1.25 },
      { model_pattern: 'o1', cost_in_per_m: 15.0, cost_out_per_m: 60.0, cost_cache_read_per_m: 7.5 },
      { model_pattern: 'o3-mini', cost_in_per_m: 1.1, cost_out_per_m: 4.4, cost_cache_read_per_m: 0.55 },
      { model_pattern: 'deepseek-r1', cost_in_per_m: 0.55, cost_out_per_m: 2.19, cost_cache_read_per_m: 0.14 },
      { model_pattern: 'deepseek-v3', cost_in_per_m: 0.14, cost_out_per_m: 0.28, cost_cache_read_per_m: 0.014 },
      { model_pattern: '', cost_in_per_m: 3.0, cost_out_per_m: 15.0, cost_cache_read_per_m: 0.3 },
    ];

    const allRules = [...customRules, ...defaultRules];

    // Get all sessions for Dhruv
    const { rows: sessions } = await client.query(
      `SELECT id, model, tokens_in, tokens_out, tokens_cache_read, tokens_cache_write, api_cost, started_at::text, ended_at::text
       FROM sync_sessions 
       WHERE member_id = $1
       ORDER BY started_at DESC`,
      [memberId]
    );

    const verifiedSessions = sessions.map(s => {
      const modelName = (s.model || '').toLowerCase();
      const rule = allRules.find((r) => r.model_pattern && matchesModelPattern(modelName, r.model_pattern)) || defaultRules[defaultRules.length - 1];

      const tokensIn = Number(s.tokens_in || 0);
      const tokensOut = Number(s.tokens_out || 0);
      const tokensCacheRead = Number(s.tokens_cache_read || 0);
      const tokensCacheWrite = Number(s.tokens_cache_write || 0);

      const freshInput = Math.max(0, tokensIn - tokensCacheRead - tokensCacheWrite);

      const calculatedCost =
        (freshInput / 1_000_000) * Number(rule.cost_in_per_m || 0) +
        (tokensOut / 1_000_000) * Number(rule.cost_out_per_m || 0) +
        (tokensCacheRead / 1_000_000) * Number(rule.cost_cache_read_per_m || 0) +
        (tokensCacheWrite / 1_000_000) * Number((rule.cost_cache_write_per_m ?? rule.cost_in_per_m) || 0);

      const diff = Math.abs(calculatedCost - Number(s.api_cost));

      return {
        id: s.id,
        model: s.model,
        matchedPattern: rule.model_pattern,
        tokensIn,
        tokensOut,
        tokensCacheRead,
        tokensCacheWrite,
        freshInput,
        storedCost: Number(s.api_cost),
        calculatedCost,
        diff,
        isCorrect: diff < 0.0001
      };
    });

    fs.writeFileSync(
      path.join(__dirname, 'query_result.json'),
      JSON.stringify(verifiedSessions, null, 2)
    );
    console.log('[DEBUG RUNNER] Successfully wrote query_result.json');

  } catch (err) {
    fs.writeFileSync(
      path.join(__dirname, 'query_result.json'),
      JSON.stringify({ error: err.message }, null, 2)
    );
  } finally {
    await client.end();
  }
}

run();
