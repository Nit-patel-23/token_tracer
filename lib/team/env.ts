import fs from 'node:fs';
import path from 'node:path';

let loaded = false;

/** Fallback loader for .env.local and .env files */
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
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!val) continue;
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    } catch {
      // ignore
    }
  }
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

export function sessionSecret(): string {
  loadEnv();
  const secret = process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'CRITICAL SECURITY ERROR: SESSION_SECRET or ADMIN_PASSWORD must be configured in production mode. ' +
        'Refusing to fallback to insecure default secret.'
      );
    }
    return 'dev-insecure-change-me';
  }
  return secret;
}

export function cronSecret(): string | null {
  loadEnv();
  return process.env.CRON_SECRET || null;
}
