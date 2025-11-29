// config/database.js - PERBAIKI VERSION
const { Pool } = require('pg');
require('dotenv').config();

console.log('🔧 Database Configuration Check:');
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PASSWORD type:', typeof process.env.DB_PASSWORD);
console.log('DB_PASSWORD length:', process.env.DB_PASSWORD ? process.env.DB_PASSWORD.length : 'NULL');

// Pastikan password adalah string yang valid
const dbPassword = process.env.DB_PASSWORD || '';
if (typeof dbPassword !== 'string') {
  console.error('❌ ERROR: DB_PASSWORD is not a string!');
  process.exit(1);
}

const pool = new Pool({
  user: process.env.DB_USER || 'lasalle_user',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'lasalleserve',
  password: dbPassword, // Gunakan variable yang sudah divalidasi
  port: parseInt(process.env.DB_PORT) || 5432,
  ssl: false, // TAMBAHKAN untuk development
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
});

// Test connection dengan error handling yang lebih baik
const testConnection = async () => {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query('SELECT version()');
    console.log('✅ BERHASIL terhubung ke Database LasalleServe!');
    console.log('📊 PostgreSQL Version:', result.rows[0].version);
    
    // Test query tambahan untuk memastikan tables ada
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log('📋 Tables found:', tablesResult.rows.map(row => row.table_name));
    
    return true;
  } catch (error) {
    console.error('❌ GAGAL terhubung ke database:', error.message);
    console.error('Error details:', error);
    return false;
  } finally {
    if (client) client.release();
  }
};

const query = (text, params) => pool.query(text, params);
const getClient = () => pool.connect();

module.exports = {
  query,
  getClient,
  testConnection,
  pool
};