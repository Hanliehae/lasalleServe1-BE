const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

async function runMigrations() {
  const pool = new Pool({
    user: process.env.DB_USER || 'lasalle_user',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'lasalleserve',
    password: process.env.DB_PASSWORD || 'password',
    port: parseInt(process.env.DB_PORT) || 5432,
  });

  const client = await pool.connect();
  
  try {
    console.log('🚀 Running migrations...');
    
    // Hanya jalankan migrasi 008_final_fix.sql
    const migrations = ['008_final_fix.sql'];
    
    for (const migrationFile of migrations) {
      const filePath = path.join(__dirname, 'migrations', migrationFile);
      try {
        const sql = await fs.readFile(filePath, 'utf8');
        console.log(`📦 Running ${migrationFile}...`);
        await client.query(sql);
        console.log(`✅ ${migrationFile} completed`);
      } catch (error) {
        console.error(`❌ Error running ${migrationFile}:`, error.message);
        console.error('SQL Error Detail:', error);
      }
    }
    
    console.log('🎉 Migration completed!');
    
    // Tampilkan data users
    console.log('\n👥 Current users in database:');
    const users = await client.query(`
      SELECT id, email, name, role, 
             CASE WHEN password IS NULL THEN 'NULL' 
                  ELSE 'HAS PASSWORD' END as password_status
      FROM users 
      ORDER BY created_at
    `);
    
    users.rows.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email} (${user.name}) - ${user.role} - ${user.password_status}`);
    });
    
  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();