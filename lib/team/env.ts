/**
 * Environment variable helpers (Next.js / Vercel compatible).
 * All secrets are read from process.env — set them in Vercel's dashboard
 * or in .env.local for local development.
 */

/** Resolve Neon / Postgres connection string. */
export function databaseUrl(): string | null {
  return process.env.DATABASE_URL || process.env.NEON_CONNECTION_STRING || null;
}

export function requireDatabaseUrl(): string {
  const url = databaseUrl();
  if (!url) throw new Error('DATABASE_URL or NEON_CONNECTION_STRING is required');
  return url;
}

export function adminPassword(): string | null {
  return process.env.ADMIN_PASSWORD || null;
}

export function sessionSecret(): string {
  return process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || 'dev-insecure-change-me';
}
