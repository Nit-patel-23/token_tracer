/**
 * Personal dashboard state endpoint.
 * Returns session list + summaries for the sidebar tree.
 *
 * GET /api/state?from=YYYY-MM-DD&to=YYYY-MM-DD&source=cursor&all=1
 *
 * Returns 503 on Vercel (no local filesystem access).
 */
import { NextRequest, NextResponse } from 'next/server';
import { scanSessions } from '@/lib/scan.mjs';
import { normalizeDateParam, sessionInDateRange, sessionSummary } from '@/lib/analytics.mjs';
import pricingData from '@/lib/pricing.json';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  if (process.env.VERCEL === '1') {
    return NextResponse.json({
      roots: [], counts: {}, sessions: [], from: null, to: null, all: true,
      generatedAt: new Date().toISOString(),
      error: 'Personal dashboard is not available on Vercel. Run `npm run dev` locally.',
      vercel: true,
    }, { status: 503 });
  }

  try {
    const url = req.nextUrl;
    const src = url.searchParams.get('source');
    const allParam = url.searchParams.get('all');
    const all = allParam === '1' || allParam === 'true';
    let from = normalizeDateParam(url.searchParams.get('from'));
    let to = normalizeDateParam(url.searchParams.get('to'));
    if (from && to && from > to) { const tmp = from; from = to; to = tmp; }

    const useAll = all || (!from && !to);
    const { roots, sessions: allSessions } = scanSessions({});

    let dated: SessionObj[] = allSessions as SessionObj[];
    if (!useAll) {
      dated = dated.filter((s) => sessionInDateRange(s, from, to));
    }

    const counts: Record<string, number> = {};
    for (const s of dated) counts[s.source] = (counts[s.source] || 0) + 1;

    const filtered = src && src !== 'all' ? dated.filter((s) => s.source === src) : dated;

    return NextResponse.json({
      roots,
      counts,
      from: from ?? null,
      to: to ?? null,
      all: useAll,
      generatedAt: new Date().toISOString(),
      sessions: filtered.map((s) => sessionSummary(s, pricingData)),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
