// Global type declarations for the agentvis project

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
  [key: string]: unknown;
}

declare module '@/lib/scan.mjs' {
  export function scanSessions(opts?: {
    explicitDir?: string | null;
    sources?: string[] | null;
    cache?: Map<string, unknown>;
  }): {
    roots: string[];
    sessions: object[];
    byId: Map<string, object>;
  };
}

declare module '@/lib/analytics.mjs' {
  export function buildStats(
    sessions: object[],
    opts?: {
      days?: number;
      from?: string;
      to?: string;
      pricing?: unknown;
    },
  ): unknown;

  export function normalizeDateParam(value: string | null | undefined): string | null;
  export function sessionInDateRange(session: object, from: string | null, to: string | null): boolean;
  export function sessionSummary(session: object, pricing: unknown, includeEvents?: boolean): unknown;
  export const dayKey: (ts: Date | string) => string | null;
}
