import { query } from './lib/team/db';

async function main() {
  try {
    const teams = await query('SELECT * FROM teams');
    console.log('TEAMS:', teams.rows);
    const users = await query('SELECT id, username, role, team_id, member_id FROM users');
    console.log('USERS:', users.rows);
  } catch (err) {
    console.error('DB ERROR:', err);
  }
  process.exit(0);
}

main();
