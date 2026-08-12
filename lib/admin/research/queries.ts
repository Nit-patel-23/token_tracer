'use client';

import { useQuery } from '@tanstack/react-query';
import type { ResearchFilters } from './useResearchFilters';

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

function toQueryString(filters: ResearchFilters, extra?: Record<string, string | null | undefined>) {
  const params = new URLSearchParams();
  params.set('range', filters.range);
  if (filters.org) params.set('org', filters.org);
  if (filters.tool) params.set('tool', filters.tool);
  if (filters.model) params.set('model', filters.model);
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v) params.set(k, v);
    }
  }
  return params.toString();
}

export interface ErrorSpikeSeriesRow {
  day: string;
  totalTurns: number;
  errorTurns: number;
  errorRate: number;
  rollingMean: number | null;
  rollingStddev: number | null;
  isSpike: boolean;
}

export interface ErrorSpikesResponse {
  series: ErrorSpikeSeriesRow[];
  toolBreakdown: { day: string; toolName: string; errorCount: number }[];
  drilldown: unknown[] | null;
}

export function useErrorSpikes(filters: ResearchFilters, drilldownDay?: string | null) {
  const qs = toQueryString(filters, { day: drilldownDay });
  return useQuery({
    queryKey: ['admin-research', 'error-spikes', qs],
    queryFn: () => fetchJson<ErrorSpikesResponse>(`/api/admin/research/error-spikes?${qs}`),
  });
}

export interface ContextSaturationResponse {
  rows: { model: string; fillBucket: number; toolErrorRate: number; validToolCallRate: number; sampleSize: number }[];
  inflectionPoints: Record<string, number | null>;
  scatter: { model: string; fillPct: number; toolErrorFlag: boolean; sessionId: string; turnIndex: number }[];
}

export function useContextSaturation(filters: ResearchFilters) {
  const qs = toQueryString(filters);
  return useQuery({
    queryKey: ['admin-research', 'context-saturation', qs],
    queryFn: () => fetchJson<ContextSaturationResponse>(`/api/admin/research/context-saturation?${qs}`),
  });
}

export interface DaemonCohortRow {
  daemonVersion: string;
  sessionCount: number;
  errorRate: number;
  firstSeen: string;
  lastSeen: string;
}

export function useDaemonCohorts(filters: ResearchFilters) {
  const qs = toQueryString(filters);
  return useQuery({
    queryKey: ['admin-research', 'daemon-cohorts', qs],
    queryFn: () => fetchJson<{ cohorts: DaemonCohortRow[] }>(`/api/admin/research/daemon-cohorts?${qs}`),
  });
}

export function usePromptSpecificity(filters: ResearchFilters) {
  const qs = toQueryString(filters);
  return useQuery({
    queryKey: ['admin-research', 'prompt-specificity', qs],
    queryFn: () => fetchJson<unknown[]>(`/api/admin/research/prompt-specificity?${qs}`),
  });
}

export function useVerbosityElasticity(filters: ResearchFilters, intent?: string | null) {
  const qs = toQueryString(filters, { intent });
  return useQuery({
    queryKey: ['admin-research', 'verbosity-elasticity', qs],
    queryFn: () => fetchJson<{ stats: unknown[]; points: unknown[] }>(`/api/admin/research/verbosity-elasticity?${qs}`),
  });
}

export function useCostPerformanceFrontier(filters: ResearchFilters, intent?: string | null) {
  const qs = toQueryString(filters, { intent });
  return useQuery({
    queryKey: ['admin-research', 'cost-performance-frontier', qs],
    queryFn: () => fetchJson<Record<string, unknown[]>>(`/api/admin/research/cost-performance-frontier?${qs}`),
  });
}

export function useRedundantReprompt(filters: ResearchFilters) {
  const qs = toQueryString(filters);
  return useQuery({
    queryKey: ['admin-research', 'redundant-reprompt', qs],
    queryFn: () => fetchJson<{ pilotOnly: boolean; eligibleOrg: string | null; events?: unknown[] }>(
      `/api/admin/research/redundant-reprompt?${qs}`,
    ),
  });
}
