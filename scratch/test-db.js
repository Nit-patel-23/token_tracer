import { query } from '../lib/team/db.js';

(async () => {
  try {
    const { rows: sessions } = await query('SELECT count(*)::int as count FROM sync_sessions');
    console.log('Total sync_sessions in DB:', sessions[0].count);
    
    const { rows: users } = await query('SELECT username, member_id, api_key FROM users');
    console.log('Users in DB:', users);

    const { rows: members } = await query('SELECT id, display_name, team_id FROM members');
    console.log('Members in DB:', members);

    const { rows: keys } = await query('SELECT member_id, key_hash FROM member_keys');
    console.log('Member keys in DB:', keys);
  } catch (err) {
    console.error('Error querying DB:', err);
  }
})();
