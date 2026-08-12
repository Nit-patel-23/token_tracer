import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/lib/auth';

/**
 * Shared superadmin guard for research/analytics API routes.
 * Returns a 403 NextResponse to short-circuit on, or null if authorized.
 */
export function requireSuperadminApi(req: NextRequest): NextResponse | null {
  const session = getSessionFromCookie(req.headers.get('cookie'));
  if (!session || session.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

/** Parses a `range` query param like "30d" into a day count, clamped to [1, max]. */
export function parseRangeDays(range: string | null, opts: { def?: number; max?: number } = {}): number {
  const def = opts.def ?? 30;
  const max = opts.max ?? 90;
  if (!range) return def;
  const m = range.match(/^(\d+)d$/);
  return m ? Math.min(Math.max(1, Number(m[1])), max) : def;
}

export interface FilterSpec {
  /** Query param name, e.g. "model" */
  param: string;
  /** SQL column expression to compare against, e.g. "st.model" */
  column: string;
}

/**
 * Builds a parameterized WHERE clause from a base condition plus a set of
 * optional equality filters read from search params. Skips filters whose
 * param is absent, so callers only pay for the ones they actually filter on.
 */
export function buildResearchFilters(
  searchParams: URLSearchParams,
  baseCondition: string,
  baseParams: unknown[],
  specs: FilterSpec[],
): { whereClause: string; params: unknown[] } {
  const conditions = [baseCondition];
  const params = [...baseParams];
  let idx = params.length + 1;

  for (const spec of specs) {
    const val = searchParams.get(spec.param);
    if (val) {
      conditions.push(`${spec.column} = $${idx}`);
      params.push(val);
      idx++;
    }
  }

  return { whereClause: conditions.join(' AND '), params };
}
