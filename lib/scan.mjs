/**
 * Shared session discovery + parse (personal dashboard + team daemon).
 * No team/* imports — keep personal mode independent.
 */
import fs from 'node:fs';
import path from 'node:path';
import { makeAdapters } from './adapters.mjs';

function shortPath(p) {
  const home = process.env.HOME;
  return home && p.startsWith(home) ? '~' + p.slice(home.length) : p;
}

/**
 * Discover and parse all transcript files.
 * @param {{ explicitDir?: string|null, sources?: string[]|null, cache?: Map }} opts
 * @returns {{ roots: string[], sessions: object[], byId: Map<string, object> }}
 */
export function scanSessions({ explicitDir = null, sources = null, cache = new Map() } = {}) {
  const adapters = makeAdapters({ explicitDir, sources });
  const sessions = [];
  const roots = new Set();
  const liveFiles = new Set();

  for (const adapter of adapters) {
    for (const desc of adapter.findFiles()) {
      let st;
      try { st = fs.statSync(desc.file); } catch { continue; }
      liveFiles.add(desc.file);
      let entry = cache.get(desc.file);
      if (!entry || entry.mtimeMs !== st.mtimeMs || entry.size !== st.size) {
        let parsed;
        try { parsed = adapter.parseFile(desc); } catch { parsed = []; }
        entry = { mtimeMs: st.mtimeMs, size: st.size, sessions: parsed };
        cache.set(desc.file, entry);
      }
      for (const s of entry.sessions) {
        sessions.push(s);
        roots.add(`${adapter.source}: ${shortPath(path.dirname(desc.file))}`);
      }
    }
  }

  for (const f of cache.keys()) if (!liveFiles.has(f)) cache.delete(f);

  const byId = new Map(sessions.map((s) => [s.id.toLowerCase(), s]));
  for (const s of sessions) {
    for (const { uuid, ev } of s.spawnCandidates) {
      const child = byId.get(uuid);
      if (child && child !== s && !child.parent) {
        child.parent = s.id;
        if (!s.children.includes(child.id)) s.children.push(child.id);
        ev.tool.spawnTarget ??= child.id;
      }
    }
  }

  return { roots: [...roots].sort(), sessions, byId };
}
