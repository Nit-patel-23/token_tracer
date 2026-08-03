/**
 * POST /api/auth/login
 * Unified login for user / admin / superadmin.
 *
 * username=team + ADMIN_PASSWORD     → admin session → redirect /team
 * username=superadmin + SUPERADMIN_PASSWORD → superadmin → redirect /admin
 * any other username                 → DB lookup, bcrypt verify → redirect /
 */
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { adminPassword, superadminPassword } from '@/lib/team/env';
import { verifyAdminPassword } from '@/lib/team/auth';
import {
  findUserByUsername, verifyPassword, touchLastLogin,
  buildSessionCookie, type SessionPayload,
} from '@/lib/auth';

export const dynamic = 'force-dynamic';

function isSecure(req: NextRequest): boolean {
  return process.env.VERCEL === '1' ||
    req.headers.get('x-forwarded-proto') === 'https' ||
    process.env.NODE_ENV === 'production';
}

export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch {
      return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
    }

    const username = String(body.username ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');

    if (!username || !password) {
      return NextResponse.json({ error: 'username and password are required' }, { status: 400 });
    }

    const secure = isSecure(req);
    let payload: SessionPayload;

    // ── Admin login ───────────────────────────────────────────────────────────
    if (username === 'team') {
      const pwd = adminPassword();
      if (!pwd) return NextResponse.json({ error: 'Admin login is not configured' }, { status: 503 });
      if (!verifyAdminPassword(password)) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      }
      payload = {
        userId: 'admin',
        username: 'team',
        displayName: 'Team Admin',
        role: 'admin',
        memberId: null,
        teamId: null,
        issuedAt: Date.now(),
      };
      const res = NextResponse.json({ ok: true, redirect: '/team' });
      res.headers.set('Set-Cookie', buildSessionCookie(payload, secure));
      return res;
    }

    // ── Superadmin login ──────────────────────────────────────────────────────
    if (username === 'superadmin') {
      const pwd = superadminPassword();
      if (!pwd) return NextResponse.json({ error: 'Superadmin login is not configured' }, { status: 503 });
      const a = Buffer.from(password);
      const b = Buffer.from(pwd);
      const match = a.length === b.length && crypto.timingSafeEqual(a, b);
      if (!match) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      }
      payload = {
        userId: 'superadmin',
        username: 'superadmin',
        displayName: 'Super Admin',
        role: 'superadmin',
        memberId: null,
        teamId: null,
        issuedAt: Date.now(),
      };
      const res = NextResponse.json({ ok: true, redirect: '/admin' });
      res.headers.set('Set-Cookie', buildSessionCookie(payload, secure));
      return res;
    }

    // ── Regular user login ────────────────────────────────────────────────────
    const user = await findUserByUsername(username);
    if (!user || !user.active) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    const match = await verifyPassword(password, user.password_hash);
    if (!match) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    await touchLastLogin(user.id);

    payload = {
      userId: user.id,
      username: user.username,
      displayName: user.display_name,
      role: user.role,
      memberId: user.member_id,
      teamId: user.team_id,
      issuedAt: Date.now(),
    };

    const res = NextResponse.json({ ok: true, redirect: '/' });
    res.headers.set('Set-Cookie', buildSessionCookie(payload, secure));
    return res;
  } catch (err) {
    console.error('[auth/login error]', err);
    return NextResponse.json({ error: String((err as Error).message || err) }, { status: 500 });
  }
}
