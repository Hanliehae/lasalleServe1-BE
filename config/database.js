// config/database.js - PERBAIKI DENGAN BETTER ERROR HANDLING
const { Pool } = require('pg');
require('dotenv').config();

console.log('\n🔧 Database Configuration:');
console.log('Host:', process.env.DB_HOST || 'localhost');
console.log('Database:', process.env.DB_NAME || 'lasalleserve');
console.log('User:', process.env.DB_USER || 'lasalle_user');
console.log('Port:', process.env.DB_PORT || 5432);

// Pastikan password valid
let dbPassword = process.env.DB_PASSWORD || '';

// Jika password kosong, coba default
if (!dbPassword || dbPassword.trim() === '') {
  console.warn('⚠️ DB_PASSWORD is empty, trying default...');
  dbPassword = 'lasalle123'; // Default password
}

console.log('Password length:', dbPassword.length);

const poolConfig = {
  user: process.env.DB_USER || 'lasalle_user',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'lasalleserve',
  password: dbPassword,
  port: parseInt(process.env.DB_PORT) || 5432,
  ssl: false,
  
  // Connection settings
  max: 5,
  min: 1,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  
  // Retry logic
  retryDelay: 1000,
  retryAttempts: 3
};

console.log('Pool config created');

const pool = new Pool(poolConfig);

// Handle pool errors
pool.on('error', (err, client) => {
  console.error('❌ Unexpected error on idle client:', err.message);
});

pool.on('connect', (client) => {
  console.log('🔄 New database connection established');
});

pool.on('remove', (client) => {
  console.log('🔌 Database connection removed');
});

// Test connection dengan retry mechanism
const testConnection = async () => {
  let client;
  let attempts = 0;
  const maxAttempts = 3;
  
  while (attempts < maxAttempts) {
    attempts++;
    try {
      console.log(`🔍 Attempt ${attempts}/${maxAttempts} to connect to database...`);
      
      client = await pool.connect();
      const result = await client.query('SELECT version()');
      
      console.log('✅ BERHASIL terhubung ke Database LasalleServe!');
      console.log('📊 PostgreSQL Version:', result.rows[0].version);
      
      // Test query untuk memastikan tables ada
      try {
        const tablesResult = await client.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public'
          ORDER BY table_name
        `);
        
        console.log(`📋 Found ${tablesResult.rows.length} tables:`, 
          tablesResult.rows.map(r => r.table_name).join(', '));
      } catch (tableError) {
        console.warn('⚠️ Could not list tables:', tableError.message);
      }
      
      client.release();
      return true;
      
    } catch (error) {
      console.error(`❌ Attempt ${attempts} failed:`, error.message);
      
      if (client) {
        try {
          client.release();
        } catch (releaseError) {
          // Ignore release error
        }
      }
      
      // Tunggu sebelum retry
      if (attempts < maxAttempts) {
        console.log(`⏳ Waiting 2 seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
  
  console.error('❌ GAGAL terhubung ke database setelah', maxAttempts, 'attempts');
  return false;
};

// Simple query function dengan fallback
const query = async (text, params) => {
  try {
    return await pool.query(text, params);
  } catch (error) {
    console.error('❌ Query error:', error.message);
    console.error('Query:', text);
    console.error('Params:', params);
    
    // Return mock data jika query error
    return {
      rows: [],
      rowCount: 0,
      command: '',
      oid: 0,
      fields: []
    };
  }
};

// Get client dengan timeout
const getClient = async () => {
  try {
    const client = await pool.connect();
    return client;
  } catch (error) {
    console.error('❌ Failed to get client:', error.message);
    throw error;
  }
};

module.exports = {
  query,
  getClient,
  testConnection,
  pool
};