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
    const teamIds: string[] | undefined = Array.isArray(body.teamIds) ? body.teamIds : (teamId ? [teamId] : undefined);

    if (!id || !displayName) {
      return NextResponse.json({ error: 'id and displayName are required' }, { status: 400 });
    }

    const { rows } = await query(
      `UPDATE members SET display_name = $2, team_id = COALESCE($3, team_id) WHERE id = $1 RETURNING id, display_name, team_id`,
      [id, displayName, teamId || (teamIds && teamIds[0]) || null]
    );

    if (!rows[0]) {
      return NextResponse.json({ error: 'member not found' }, { status: 404 });
    }

    // Sync team_members if teamIds provided
    if (teamIds) {
      // Add newly selected teams
      for (const tId of teamIds) {
        if (tId) {
          await query(
            `INSERT INTO team_members (team_id, member_id, role)
             VALUES ($1, $2, 'member')
             ON CONFLICT (team_id, member_id) DO NOTHING`,
            [tId, id],
          );
        }
      }

      // Remove unselected teams
      if (teamIds.length > 0) {
        await query(
          `DELETE FROM team_members WHERE member_id = $1 AND team_id NOT = ANY($2::uuid[])`,
          [id, teamIds],
        );
      }
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
