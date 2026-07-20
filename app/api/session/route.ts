/**
 * Personal session detail endpoint.
 * Returns full event trajectory for a single session.
 *
 * GET /api/session?id=<sessionId>
 *
 * Returns 503 on Vercel (no local filesystem access).
 */
import { NextRequest, NextResponse } from 'next/server';
import { scanSessions } from '@/lib/scan.mjs';
import { sessionSummary } from '@/lib/analytics.mjs';
import pricingData from '@/lib/pricing.json';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  if (process.env.VERCEL === '1') {
    return NextResponse.json(
      { error: 'Personal dashboard is not available on Vercel. Run `npm run dev` locally.' },
      { status: 503 },
    );
  }

  try {
    const id = (req.nextUrl.searchParams.get('id') || '').toLowerCase();
    if (!id) {
      return NextResponse.json({ error: 'id parameter is required' }, { status: 400 });
    }

    const { byId } = scanSessions({});
    const session = byId.get(id) as SessionObj | undefined;
    if (!session) {
      return NextResponse.json({ error: 'session not found' }, { status: 404 });
    }

    return NextResponse.json(sessionSummary(session, pricingData, true));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
