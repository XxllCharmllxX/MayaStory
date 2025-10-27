// Test script to check database connection
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function testConnection() {
  try {
    console.log('Testing database connection...');
    const result = await pool.query('SELECT NOW() as current_time');
    console.log('✅ Database connected successfully!');
    console.log('Current time:', result.rows[0].current_time);

    // Test if accounts table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'accounts'
      );
    `);

    if (tableCheck.rows[0].exists) {
      console.log('✅ Accounts table exists!');

      // Check if username "Sora" exists
      const userCheck = await pool.query('SELECT id FROM accounts WHERE name = $1', ['Sora']);
      if (userCheck.rows.length > 0) {
        console.log('✅ Username "Sora" exists in the accounts table!');
        console.log('User ID:', userCheck.rows[0].id);
      } else {
        console.log('❌ Username "Sora" does not exist in the accounts table.');
      }
    } else {
      console.log('❌ Accounts table does not exist. Run create_accounts_table.sql in Supabase.');
    }

  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  } finally {
    await pool.end();
  }
}

testConnection();
