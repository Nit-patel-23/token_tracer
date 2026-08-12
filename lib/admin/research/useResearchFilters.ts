'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export interface ResearchFilters {
  range: string;
  org: string | null;
  tool: string | null;
  model: string | null;
}

const DEFAULT_RANGE = '30d';

/**
 * Keeps the shared research filter bar (range/org/tool/model) in the URL
 * instead of client state, so a link into a filtered view (e.g. a
 * drill-down from the error-spike timeline into Prompt Explorer) is just a
 * URL — no state to thread through — and TanStack Query can key off it.
 */
export function useResearchFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters: ResearchFilters = useMemo(
    () => ({
      range: searchParams.get('range') ?? DEFAULT_RANGE,
      org: searchParams.get('org'),
      tool: searchParams.get('tool'),
      model: searchParams.get('model'),
    }),
    [searchParams],
  );

  const setFilter = useCallback(
    (key: keyof ResearchFilters, value: string | null) => {
      const next = new URLSearchParams(searchParams.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return { filters, setFilter, searchParams };
}
