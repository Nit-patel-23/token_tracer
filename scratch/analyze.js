const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.join(__dirname, '../db_dump.txt'), 'utf8');

const sections = {};
let currentSection = '';
let currentLines = [];

for (const line of content.split('\n')) {
  if (line.startsWith('### ')) {
    if (currentSection) {
      sections[currentSection] = currentLines;
    }
    currentSection = line.replace('### ', '').trim();
    currentLines = [];
  } else {
    currentLines.push(line);
  }
}
if (currentSection) {
  sections[currentSection] = currentLines;
}

function parseTable(lines) {
  if (!lines || lines.length < 3) return [];
  const headerLine = lines[0];
  const columns = headerLine.split('|').map(c => c.trim());
  const rows = [];
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('(')) continue;
    const parts = line.split('|').map(p => p.trim());
    if (parts.length < columns.length) continue;
    const row = {};
    columns.forEach((col, idx) => {
      row[col] = parts[idx];
    });
    rows.push(row);
  }
  return rows;
}

const members = parseTable(sections['members']);
const users = parseTable(sections['users']);
const sync_sessions = parseTable(sections['sync_sessions']);

console.log(`Loaded ${members.length} members, ${users.length} users, ${sync_sessions.length} sync_sessions.`);

// Aggregated tokens per member in sync_sessions
const tokenCounts = {};
sync_sessions.forEach(s => {
  const mid = s.member_id;
  const inTok = parseInt(s.tokens_in || 0, 10);
  const outTok = parseInt(s.tokens_out || 0, 10);
  const total = inTok + outTok;
  if (!tokenCounts[mid]) {
    tokenCounts[mid] = { sessions: 0, tokens: 0 };
  }
  tokenCounts[mid].sessions++;
  tokenCounts[mid].tokens += total;
});

console.log('\n--- Tokens by Member ---');
Object.entries(tokenCounts).sort((a, b) => b[1].tokens - a[1].tokens).forEach(([mid, stats]) => {
  const member = members.find(m => m.id === mid);
  const user = users.find(u => u.member_id === mid);
  console.log(`Member ID: ${mid} | Name: ${member ? member.display_name : 'unknown'} | User: ${user ? user.username : 'none'} | Sessions: ${stats.sessions} | Tokens: ${stats.tokens.toLocaleString()}`);
});

console.log('\n--- Users linked to Member Profiles ---');
users.forEach(u => {
  console.log(`User: ${u.username} | Role: ${u.role} | Linked Member ID: ${u.member_id} | Team ID: ${u.team_id}`);
});
