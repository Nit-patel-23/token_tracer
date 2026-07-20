// Type declarations for the plain .mjs library modules
// These are JavaScript ES modules with no TypeScript definitions

declare module '*/lib/scan.mjs' {
  export function scanSessions(opts?: {
    explicitDir?: string | null;
    sources?: string[] | null;
    cache?: Map<string, unknown>;
  }): {
    roots: string[];
    sessions: SessionObj[];
    byId: Map<string, SessionObj>;
  };
}

declare module '*/lib/analytics.mjs' {
  export function buildStats(
    sessions: SessionObj[],
    opts?: {
      days?: number;
      from?: string | null;
      to?: string | null;
      pricing?: unknown;
    },
  ): unknown;

  export function normalizeDateParam(value: string | null | undefined): string | null;
  export function sessionInDateRange(session: SessionObj, from: string | null, to: string | null): boolean;
  export function sessionSummary(session: SessionObj, pricing: unknown, includeEvents?: boolean): unknown;
  export const dayKey: (ts: Date | string) => string | null;
}

interface SessionObj {
  id: string;
  source: string;
  agent: string;
  file: string;
  label: string;
  model: string | null;
  startedAt: string | null;
  endedAt: string | null;
  events: unknown[];
  stats: {
    toolCounts: Record<string, number>;
    tokensIn: number;
    tokensOut: number;
    tokensCacheRead: number;
    tokensCacheWrite: number;
    messages: number;
    errors: number;
  };
  spawnCandidates: unknown[];
  children: string[];
  parent: string | null;
}
