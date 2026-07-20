/**
 * Personal dashboard stats endpoint.
 * Reads local JSONL transcript files via the scan/analytics modules.
 *
 * GET /api/stats?from=YYYY-MM-DD&to=YYYY-MM-DD&source=cursor&all=1
 *
 * IMPORTANT: This route reads from the local filesystem (~/.claude, ~/.cursor, etc.)
 * and will not work on Vercel deployments. It returns a 503 when running on Vercel.
 */
import { NextRequest, NextResponse } from 'next/server';
import { scanSessions } from '@/lib/scan.mjs';
import { buildStats, normalizeDateParam, sessionInDateRange } from '@/lib/analytics.mjs';
import pricingData from '@/lib/pricing.json';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  if (process.env.VERCEL === '1') {
    return NextResponse.json(
      { error: 'Personal dashboard is not available on Vercel. Run `npm run dev` locally.', vercel: true },
      { status: 503 },
    );
  }

  try {
    const url = req.nextUrl;
    const src = url.searchParams.get('source');
    const allParam = url.searchParams.get('all');
    const all = allParam === '1' || allParam === 'true';
    let from = normalizeDateParam(url.searchParams.get('from'));
    let to = normalizeDateParam(url.searchParams.get('to'));
    if (from && to && from > to) { const tmp = from; from = to; to = tmp; }

    const { sessions: allSessions } = scanSessions({});
    let sessions: SessionObj[] = allSessions as SessionObj[];

    const useAll = all || (!from && !to);
    if (!useAll) {
      sessions = sessions.filter((s) => sessionInDateRange(s, from, to));
    }
    if (src && src !== 'all') {
      sessions = sessions.filter((s) => s.source === src);
    }

    const stats = buildStats(sessions, {
      days: useAll ? Infinity : from || to ? undefined : 30,
      from: from || undefined,
      to: to || undefined,
      pricing: pricingData,
    });

    return NextResponse.json(stats);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
