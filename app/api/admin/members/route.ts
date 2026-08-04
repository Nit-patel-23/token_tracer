import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/lib/auth';
import { query } from '@/lib/team/db';

export const dynamic = 'force-dynamic';

function requireSuperadmin(req: NextRequest): boolean {
  const session = getSessionFromCookie(req.headers.get('cookie'));
  return session?.role === 'superadmin';
}

export async function PUT(req: NextRequest) {
  if (!requireSuperadmin(req)) return NextResponse.json({ error: 'superadmin access required' }, { status: 403 });

  try {
    const body = await req.json();
    const { id, displayName, teamId } = body;

    if (!id || !displayName || !teamId) {
      return NextResponse.json({ error: 'id, displayName, and teamId are required' }, { status: 400 });
    }

    const { rows } = await query(
      `UPDATE members SET display_name = $2, team_id = $3 WHERE id = $1 RETURNING id, display_name, team_id`,
      [id, displayName, teamId]
    );

    if (!rows[0]) {
      return NextResponse.json({ error: 'member not found' }, { status: 404 });
    }

    return NextResponse.json({ member: rows[0] });
  } catch (err: any) {
    console.error('[admin/members PUT error]', err);
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!requireSuperadmin(req)) return NextResponse.json({ error: 'superadmin access required' }, { status: 403 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  try {
    const { rowCount } = await query('DELETE FROM members WHERE id = $1', [id]);
    return NextResponse.json({ ok: true, deleted: (rowCount || 0) > 0 });
  } catch (err: any) {
    console.error('[admin/members DELETE error]', err);
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
