import { NextRequest, NextResponse } from 'next/server';
import { hashPassword } from '@/lib/auth';
import { generateApiKey, hashApiKey } from '@/lib/team/auth';
import { query } from '@/lib/team/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
    }

    const username = String(body.username || '').trim().toLowerCase();
    const password = String(body.password || '');
    const displayName = String(body.displayName || '').trim();
    const role = String(body.role || 'user');
    const teamName = String(body.teamName || '').trim();

    if (!username || !password || !displayName) {
      return NextResponse.json({ error: 'username, password, and displayName are required' }, { status: 400 });
    }

    if (!['user', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'invalid role' }, { status: 400 });
    }

    // Check if username already exists
    const { rows: existingUsers } = await query('SELECT id FROM users WHERE username = $1', [username]);
    if (existingUsers.length > 0) {
      return NextResponse.json({ error: 'Username already exists' }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    let finalTeamId: string | null = null;
    let finalMemberId: string | null = null;
    let rawApiKey: string | null = null;

    if (role === 'admin') {
      if (!teamName) {
        return NextResponse.json({ error: 'teamName is required for admins' }, { status: 400 });
      }
      const { rows: teamRows } = await query(
        'INSERT INTO teams (name) VALUES ($1) RETURNING id',
        [teamName]
      );
      finalTeamId = teamRows[0].id;
    } else {
      // Find or create default Independent team
      let teamRes = await query("SELECT id FROM teams WHERE name = 'Independent' LIMIT 1");
      let independentTeamId = teamRes.rows[0]?.id;
      if (!independentTeamId) {
        const newTeamRes = await query("INSERT INTO teams (name) VALUES ('Independent') RETURNING id");
        independentTeamId = newTeamRes.rows[0].id;
      }

      // Member signup: team_id is linked to Independent team
      const { rows: memberRows } = await query(
        "INSERT INTO members (team_id, display_name, role) VALUES ($1, $2, 'member') RETURNING id",
        [independentTeamId, displayName]
      );
      finalMemberId = memberRows[0].id;

      // Generate API key for Member
      rawApiKey = generateApiKey();
      const apiKeyHash = hashApiKey(rawApiKey);

      await query(
        `INSERT INTO member_keys (member_id, key_hash, label)
         VALUES ($1, $2, 'default')`,
        [finalMemberId, apiKeyHash]
      );
    }

    const { rows: userRows } = await query(
      `INSERT INTO users (username, password_hash, display_name, member_id, team_id, role, api_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, username, display_name, role, member_id, team_id`,
      [username, passwordHash, displayName, finalMemberId, finalTeamId, role, rawApiKey]
    );

    const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'https://token-tracer-three.vercel.app';
    let installCommandMac = null;
    let installCommandWin = null;
    if (rawApiKey) {
      installCommandMac = `curl -fsSL ${serverUrl}/install.sh | bash -s -- --key ${rawApiKey}`;
      installCommandWin = `$ApiKey="${rawApiKey}"; iex (irm ${serverUrl}/install.ps1)`;
    }

    return NextResponse.json({
      ok: true,
      user: userRows[0],
      apiKey: rawApiKey,
      installCommandMac,
      installCommandWin
    }, { status: 201 });
  } catch (err: any) {
    console.error('[auth/signup error]', err);
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
