/**
 * Unified auth library for the personal/admin/superadmin login system.
 * Uses bcryptjs for password hashing and stateless HMAC tokens stored as
 * HTTP-only cookies for session management.
 */
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { sessionSecret } from '@/lib/team/env';
import { query } from '@/lib/team/db';
import { adminTokenFromCookie, verifyAdminToken } from './team/auth';

export const COOKIE_NAME = 'app_session';
export const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

export type Role = 'user' | 'admin' | 'superadmin';

export interface SessionPayload {
  userId: string;   // For users: UUID from users table. For admin/superadmin: 'admin' | 'superadmin'
  username: string;
  displayName: string;
  role: Role;
  memberId: string | null;
  teamId: string | null;
  issuedAt: number;
}

// ── Password helpers ──────────────────────────────────────────────────────────

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ── Token helpers (HMAC-based stateless session) ──────────────────────────────

function tokenSecret(): string {
  return sessionSecret();
}

/** Encode a session payload into a signed token string. */
export function encodeSessionToken(payload: SessionPayload): string {
  const data = JSON.stringify(payload);
  const b64 = Buffer.from(data).toString('base64url');
  const sig = crypto
    .createHmac('sha256', tokenSecret())
    .update(b64)
    .digest('base64url');
  return `${b64}.${sig}`;
}

/** Decode and verify a session token. Returns null if invalid or expired. */
export function decodeSessionToken(token: string | null | undefined): SessionPayload | null {
  if (!token) return null;
  try {
    const dot = token.lastIndexOf('.');
    if (dot < 0) return null;
    const b64 = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const expectedSig = crypto
      .createHmac('sha256', tokenSecret())
      .update(b64)
      .digest('base64url');
    // Timing-safe compare
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

    const payload = JSON.parse(Buffer.from(b64, 'base64url').toString()) as SessionPayload;
    // Expire after 7 days
    if (Date.now() - payload.issuedAt > COOKIE_MAX_AGE * 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Read and verify the session token from a cookie header string. */
export function getSessionFromCookie(cookieHeader: string | null | undefined): SessionPayload | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k.trim() === COOKIE_NAME) {
      return decodeSessionToken(decodeURIComponent(rest.join('=')));
    }
  }
  return null;
}

/** Build the Set-Cookie header value for the session token. */
export function buildSessionCookie(payload: SessionPayload, secure: boolean): string {
  const token = encodeSessionToken(payload);
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}${secure ? '; Secure' : ''}`;
}

/** Build a cookie that clears the session. */
export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

// ── Database user helpers ─────────────────────────────────────────────────────

export interface DbUser {
  id: string;
  username: string;
  password_hash: string;
  display_name: string;
  member_id: string | null;
  team_id: string | null;
  role: Role;
  active: boolean;
}

export async function findUserByUsername(username: string): Promise<DbUser | null> {
  const { rows } = await query<DbUser>(
    `SELECT id, username, password_hash, display_name, member_id, team_id, role, active
     FROM users WHERE username = $1`,
    [username],
  );
  return rows[0] || null;
}

export async function touchLastLogin(userId: string): Promise<void> {
  await query('UPDATE users SET last_login_at = now() WHERE id = $1', [userId]);
}

/** Fetch the active API key for a member (first non-revoked key). */
export async function getMemberApiKey(memberId: string): Promise<string | null> {
  const { rows } = await query(
    `SELECT k.key_hash FROM member_keys k
     WHERE k.member_id = $1 AND k.revoked_at IS NULL
     ORDER BY k.created_at ASC LIMIT 1`,
    [memberId],
  );
  // key_hash is stored, not the raw key — we can't recover the raw key from hash.
  // Return null here; the raw key should be stored/displayed at creation time only.
  // We will instead expose it via a separate endpoint that regenerates if needed.
  return rows[0]?.key_hash ? null : null; // placeholder — raw key not recoverable
}

/**
 * Verifies if the request is from an admin or superadmin, and returns the authorized teamId.
 * - If superadmin, returns the requested teamId (from parameters).
 * - If admin, strictly overrides and returns their associated teamId.
 * - Returns null if unauthorized or missing permissions.
 */
export function getAuthorizedTeamId(req: any, paramTeamId: string | null | undefined): string | null {
  const session = getSessionFromCookie(req.headers.get('cookie'));
  if (session) {
    if (session.role === 'superadmin') {
      return paramTeamId || null;
    }
    if (session.role === 'admin') {
      return session.teamId || paramTeamId || null;
    }
  }

  // Fallback check for legacy static admin password token
  const authHeader = req.headers.get('authorization');
  let legacyToken = '';
  if (authHeader?.startsWith('Bearer ')) {
    legacyToken = authHeader.slice(7);
  } else {
    legacyToken = adminTokenFromCookie(req.headers.get('cookie')) || '';
  }
  if (verifyAdminToken(legacyToken)) {
    return paramTeamId || null;
  }

  return null;
}
