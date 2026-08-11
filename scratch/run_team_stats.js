const { buildTeamStats } = require('../lib/team/stats');
const { query } = require('../lib/team/db');

async function main() {
  // Let's find all teams first
  const { rows: teams } = await query('SELECT id, name FROM teams');
  console.log('Teams:', teams);
  
  for (const team of teams) {
    console.log(`\n=== Team: ${team.name} (${team.id}) ===`);
    const stats = await buildTeamStats(team.id);
    console.log('Leaderboard:');
    stats.leaderboard.forEach(row => {
      const totalTokens = Number(row.tokens_in || 0) + Number(row.tokens_out || 0);
      console.log(`- Member Name: ${row.display_name.padEnd(12)} | Member ID: ${row.member_id} | Sessions: ${row.sessions} | Tokens: ${totalTokens.toLocaleString()}`);
    });
  }
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
