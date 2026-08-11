const { Pool } = require('pg');

const url = "postgresql://neondb_owner:npg_ZAGKmM7na2bq@ep-soft-resonance-azhtqsdx.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";
const pool = new Pool({
  connectionString: url.replace(/[\?&]sslmode=[^&]+/g, ''),
  ssl: { rejectUnauthorized: false }
});

async function test() {
  try {
    const res = await pool.query('SELECT tablename FROM pg_tables WHERE schemaname = $1', ['public']);
    console.log('Tables:', res.rows.map(r => r.tablename));

    const fks = await pool.query(`
      SELECT
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
      FROM 
        information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public';
    `);
    console.log('Foreign Keys:', fks.rows);

    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

test();
