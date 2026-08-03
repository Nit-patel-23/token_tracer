import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';

const { Pool } = pg;

function loadEnv() {
  const filePath = path.join(process.cwd(), '.env.local');
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
      if (val) process.env[key] = val;
    }
  } catch (err) {
    console.error('Env load error:', err);
  }
}

async function main() {
  loadEnv();
  const url = process.env.DATABASE_URL || process.env.NEON_CONNECTION_STRING;
  if (!url) {
    console.error('No connection string found');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
  try {
    const teams = await pool.query('SELECT * FROM teams');
    console.log('TEAMS:', teams.rows);
    const users = await pool.query('SELECT id, username, role, team_id, member_id FROM users');
    console.log('USERS:', users.rows);
  } catch (err) {
    console.error('DB ERROR:', err);
  } finally {
    await pool.end();
  }
}

main();
