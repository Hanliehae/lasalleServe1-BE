const { Pool } = require('pg');
require('dotenv').config();

console.log('🔧 Configuring database connection...');
console.log('Database:', process.env.DB_NAME);
console.log('User:', process.env.DB_USER);
console.log('Host:', process.env.DB_HOST);

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Test connection function
const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('✅ BERHASIL terhubung ke Database LasalleServe!');
    
    // Test query
    const result = await client.query('SELECT version()');
    console.log('📊 PostgreSQL Version:', result.rows[0].version);
    
    client.release();
    return true;
  } catch (error) {
    console.error('❌ GAGAL terhubung ke database:');
    console.error('   Error:', error.message);
    console.error('');
    console.error('🔧 TROUBLESHOOTING:');
    console.error('   1. Pastikan PostgreSQL sedang berjalan');
    console.error('   2. Cek konfigurasi di file .env');
    console.error('   3. Test koneksi manual: psql -U lasalle_user -d lasalleserve');
    console.error('   4. Pastikan password benar');
    return false;
  }
};

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  testConnection
};