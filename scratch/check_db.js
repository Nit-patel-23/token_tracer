const { Client } = require('pg');

async function run() {
  const connectionString = 'postgresql://neondb_owner:npg_ZAGKmM7na2bq@ep-soft-resonance-azhtqsdx.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';
  const client = new Client({ connectionString });
  await client.connect();

  try {
    // 1. Get parth's member details
    const { rows: members } = await client.query(
      "SELECT * FROM members WHERE display_name = 'parth'"
    );
    console.log('Parth Member:', members[0]);

    if (!members[0]) return;
    const memberId = members[0].id;

    // 2. Query yesterday's (August 10, 2026) sessions for Parth
    const { rows: sessions } = await client.query(
      `SELECT * FROM sync_sessions 
       WHERE member_id = $1 
         AND (started_at::date = '2026-08-10'::date 
              OR ended_at::date = '2026-08-10'::date
              OR synced_at::date = '2026-08-10'::date)`,
      [memberId]
    );

    console.log(`Yesterday's sessions count for Parth:`, sessions.length);
    sessions.forEach((s, idx) => {
      console.log(`[Session ${idx}] ID: ${s.session_id} | Team ID: ${s.team_id} | Source: ${s.source} | Started: ${s.started_at} | Ended: ${s.ended_at} | Synced: ${s.synced_at} | Tokens In: ${s.tokens_in} | Tokens Out: ${s.tokens_out}`);
    });

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

run();
