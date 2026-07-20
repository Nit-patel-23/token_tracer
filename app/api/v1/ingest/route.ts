import { NextRequest, NextResponse } from 'next/server';
import { memberFromAuthHeader } from '@/lib/team/auth';
import { ingestSessions } from '@/lib/team/ingest';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const member = await memberFromAuthHeader(req.headers.get('authorization'));
    if (!member) return NextResponse.json({ error: 'invalid API key' }, { status: 401 });
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
    }
    const sessions = (body.sessions as unknown[]) ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await ingestSessions(member, sessions as any);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[ingest POST error]', err);
    return NextResponse.json({ error: String((err as Error).message || err) }, { status: 500 });
  }
}
