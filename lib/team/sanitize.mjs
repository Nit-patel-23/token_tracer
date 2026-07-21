import crypto from 'node:crypto';
import path from 'node:path';
import { sessionSummary } from '../analytics.mjs';

const FORBIDDEN_KEYS = new Set([
  'events', 'text', 'content', 'prompt', 'result', 'args', 'message', 'thinking',
]);

/** Strip user home prefix from paths for privacy. */
export function sanitizePath(filePath) {
  if (typeof filePath !== 'string' || !filePath) return '';
  let p = filePath.replaceAll('\\', '/');
  const home = process.env.HOME;
  if (home && p.startsWith(home)) p = p.slice(home.length);
  p = p.replace(/^\/Users\/[^/]+/, '');
  return p.startsWith('/') ? p.slice(1) : p;
}

function stablePayloadHash(payload) {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

/** Ensure no prompt-like fields leak into sync payload. */
export function assertNoPromptFields(obj, trail = '') {
  if (obj == null || typeof obj !== 'object') return;
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) assertNoPromptFields(obj[i], `${trail}[${i}]`);
    return;
  }
  for (const [k, v] of Object.entries(obj)) {
    if (FORBIDDEN_KEYS.has(k.toLowerCase())) {
      throw new Error(`forbidden sync field: ${trail}.${k}`);
    }
    if (v && typeof v === 'object') assertNoPromptFields(v, `${trail}.${k}`);
  }
}

/**
 * Build a team-sync payload from a parsed session (aggregates + metadata only).
 * Never includes prompts, tool args, or results.
 */
function cleanAgentSlug(agent) {
  if (!agent) return 'default';
  let s = String(agent).trim();
  if (s.includes('/') || s.includes('\\')) return path.basename(s);
  if (/^(Users|home|[A-Z])-/i.test(s)) {
    s = s.replace(/^(Users|home|C)-[^-]+-(Coding|Projects|code|dev|workspace|github)-/i, '');
    s = s.replace(/^(Users|home|C)-[^-]+-/i, '');
  }
  return s || 'default';
}

export function sanitizeForTeamSync(session, pricing) {
  const summary = sessionSummary(session, pricing);
  const intel = summary.intelligence;
  const tools = Object.entries(session.stats?.toolCounts ?? {})
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
  const files = (intel.files ?? []).map((f) => ({
    path: sanitizePath(f.path),
    edits: f.edits ?? 0,
    additions: f.additions ?? 0,
    deletions: f.deletions ?? 0,
  })).filter((f) => f.path);

  const body = {
    sessionId: session.id,
    source: session.source,
    agent: cleanAgentSlug(session.agent),
    model: session.model,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    tokensIn: session.stats?.tokensIn ?? 0,
    tokensOut: session.stats?.tokensOut ?? 0,
    tokensCacheRead: session.stats?.tokensCacheRead ?? 0,
    tokensCacheWrite: session.stats?.tokensCacheWrite ?? 0,
    apiCost: intel.apiCost,
    priced: intel.apiCost != null,
    edits: intel.edits ?? 0,
    additions: intel.additions ?? 0,
    deletions: intel.deletions ?? 0,
    changedLines: intel.changedLines ?? 0,
    filesTouched: files.length,
    toolCalls: tools.reduce((n, t) => n + t.count, 0),
    toolErrors: session.stats?.errors ?? 0,
    reworkLoops: intel.reworkLoops ?? 0,
    corrections: intel.corrections ?? 0,
    abandoned: intel.abandoned ?? false,
    tools,
    files,
  };

  assertNoPromptFields(body);
  body.payloadHash = stablePayloadHash(body);
  return body;
}
