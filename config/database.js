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
  // Connection Pool Settings
  max: 20, // Maksimal 20 koneksi dalam pool
  min: 2,  // Minimal 2 koneksi tersedia
  connectionTimeoutMillis: 10000, // Waktu tunggu koneksi baru
  idleTimeoutMillis: 60000, // Koneksi idle selama 60 detik sebelum release
  acquireTimeoutMillis: 30000, // Waktu tunggu acquire koneksi dari pool
});

// Handle pool errors untuk mencegah crash
pool.on('error', (err, client) => {
  console.error('❌ Unexpected error on idle client:', err);
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