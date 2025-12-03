// run: node check_schema.js
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'lasa3 e0lle_user',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'lasalleserve',
  password: process.env.DB_PASSWORD || 'password',
  port: parseInt(process.env.DB_PORT) || 5432,
});

async function checkSchema() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking Database Schema...\n');
    
    // 1. Check loans table
    console.log('1. Checking loans table columns:');
    const loansCols = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'loans' 
      ORDER BY ordinal_position
    `);
    
    loansCols.rows.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    
    // 2. Check for required columns
    const requiredCols = ['returned_at', 'return_notes'];
    requiredCols.forEach(col => {
      const exists = loansCols.rows.some(c => c.column_name === col);
      console.log(`\n   ${exists ? '✅' : '❌'} ${col}: ${exists ? 'Exists' : 'Missing'}`);
    });
    
    // 3. Check loan_items table
    console.log('\n2. Checking loan_items table columns:');
    const itemsCols = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'loan_items' 
      ORDER BY ordinal_position
    `);
    
    itemsCols.rows.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    
    console.log(`\n   ${itemsCols.rows.some(c => c.column_name === 'returned_condition') ? '✅' : '❌'} returned_condition: ${itemsCols.rows.some(c => c.column_name === 'returned_condition') ? 'Exists' : 'Missing'}`);
    
    // 4. Sample data check
    console.log('\n3. Checking sample data:');
    
    const loansCount = await client.query('SELECT COUNT(*) as count FROM loans');
    console.log(`   Total loans: ${loansCount.rows[0].count}`);
    
    const pending = await client.query("SELECT COUNT(*) as count FROM loans WHERE status = 'disetujui'");
    console.log(`   Pending returns (disetujui): ${pending.rows[0].count}`);
    
    const completed = await client.query("SELECT COUNT(*) as count FROM loans WHERE status = 'selesai'");
    console.log(`   Completed returns (selesai): ${completed.rows[0].count}`);
    
  } catch (error) {
    console.error('Error checking schema:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

checkSchema();