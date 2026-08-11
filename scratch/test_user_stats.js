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

// Simulate the queries in /api/stats for each user
console.log('User stats simulation:\n');

users.forEach(user => {
  if (user.role !== 'user') return; // Personal stats are for regular users only
  
  // memberId resolution logic from /api/stats
  let memberId = user.member_id;
  
  if (!memberId) {
    console.log(`User: ${user.username} | NO member_id linked in users table! -> ZEROS (No profile link)`);
    return;
  }
  
  const member = members.find(m => m.id === memberId);
  if (!member) {
    console.log(`User: ${user.username} | member_id ${memberId} NOT found in members table! -> ZEROS`);
    return;
  }
  
  // Let's count sessions in sync_sessions for this member_id
  // Also let's check how the admin page queries sessions for this team / member
  const personalSessions = sync_sessions.filter(s => s.member_id === memberId);
  
  // Let's compute effective tokens like in /api/stats
  let totalTokens = 0;
  personalSessions.forEach(s => {
    let tokens_in = parseInt(s.tokens_in || 0, 10);
    let tokens_out = parseInt(s.tokens_out || 0, 10);
    let tool_calls = parseInt(s.tool_calls || 0, 10);
    let edits = parseInt(s.edits || 0, 10);
    let changed_lines = parseInt(s.changed_lines || 0, 10);
    
    let eff_in = tokens_in;
    if (tokens_in === 0 && (tool_calls + edits) > 0) {
      eff_in = Math.max(500, (tool_calls + edits) * 350 + changed_lines * 10);
    }
    
    let eff_out = tokens_out;
    if (tokens_out === 0 && (tool_calls + edits) > 0) {
      eff_out = Math.max(200, (tool_calls + edits) * 150 + changed_lines * 5);
    }
    
    totalTokens += (eff_in + eff_out);
  });
  
  console.log(`User: ${user.username.padEnd(10)} | Member Name: ${member.display_name.padEnd(10)} | Member ID: ${memberId} | Sessions: ${personalSessions.length} | Effective Tokens: ${totalTokens.toLocaleString()}`);
});
