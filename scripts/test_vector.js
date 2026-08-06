const pg = require('pg');
const fs = require('fs');

let databaseUrl = process.env.DATABASE_URL;
if (fs.existsSync('.env.local')) {
  const lines = fs.readFileSync('.env.local', 'utf8').split('\n');
  for (const line of lines) {
    const match = line.match(/^\s*DATABASE_URL\s*=\s*["']?(.*?)["']?\s*$/);
    if (match) {
      databaseUrl = match[1];
    }
  }
}

if (!databaseUrl) {
  console.error('DATABASE_URL not found');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: databaseUrl.replace(/[\?&]sslmode=[^&]+/g, ''),
  ssl: { rejectUnauthorized: false }
});

pool.query("SELECT * FROM pg_available_extensions WHERE name = 'vector';", (err, res) => {
  if (err) {
    console.error(err);
  } else {
    console.log('Available vector extensions:', res.rows);
  }
  pool.end();
});
