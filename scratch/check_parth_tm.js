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

const team_members = parseTable(sections['team_members']);
const members = parseTable(sections['members']);
const users = parseTable(sections['users']);

const parthMember = members.find(m => m.display_name === 'parth');
if (parthMember) {
  console.log('Parth Member:', parthMember);
  const parthTM = team_members.filter(tm => tm.member_id === parthMember.id);
  console.log('Parth Team Members Entries:', parthTM);
  const parthUser = users.find(u => u.username === 'parth');
  console.log('Parth User Entry:', parthUser);
} else {
  console.log('Parth member not found');
}
