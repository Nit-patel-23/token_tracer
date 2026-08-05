import fs from 'node:fs';
import path from 'node:path';

let loaded = false;

/** Fallback loader for .env.local and .env files (useful outside Next runtime). */
export function loadEnv() {
  if (loaded) return;
  loaded = true;
  const files = ['.env.local', '.env'];
  for (const f of files) {
    const filePath = path.join(process.cwd(), f);
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      for (const line of raw.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq <= 0) continue;
        const key = trimmed.slice(0, eq).trim();
        let val = trimmed.slice(eq + 1).trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        if (!val) continue;
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    } catch {
      // ignore missing files
    }
  }
}

export function isProduction(): boolean {
  loadEnv();
  return process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
}

export function databaseUrl(): string | null {
  loadEnv();
  return process.env.DATABASE_URL || process.env.NEON_CONNECTION_STRING || null;
}

export function requireDatabaseUrl(): string {
  const url = databaseUrl();
  if (!url) throw new Error('DATABASE_URL or NEON_CONNECTION_STRING is required');
  return url;
}

export function adminPassword(): string | null {
  loadEnv();
  return process.env.ADMIN_PASSWORD || null;
}

export function superadminPassword(): string | null {
  loadEnv();
  return process.env.SUPERADMIN_PASSWORD || null;
}

/**
 * Session signing secret.
 * In production this MUST be set — never fall back to ADMIN_PASSWORD or a default.
 */
export function sessionSecret(): string {
  loadEnv();
  const secret = process.env.SESSION_SECRET?.trim();
  if (secret) return secret;

  if (isProduction()) {
    throw new Error(
      'SESSION_SECRET is required in production. Generate one with: openssl rand -base64 48',
    );
  }

  // Local/dev convenience only — never used when NODE_ENV=production or on Vercel.
  return process.env.ADMIN_PASSWORD || 'dev-insecure-change-me';
}

/** Public origin used in install commands and onboarding copy. */
export function publicServerUrl(): string {
  loadEnv();
  return process.env.NEXT_PUBLIC_SERVER_URL || process.env.SERVER_URL || 'http://localhost:3000';
}
