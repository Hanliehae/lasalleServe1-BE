// server.js - FIXED VERSION
const Hapi = require('@hapi/hapi');
const { testConnection } = require('./config/database');
require('dotenv').config();

const init = async () => {
  console.log('🔄 Starting LasalleServe Backend...');
  
  // Test database connection first
  console.log('🔍 Testing database connection...');
  const dbConnected = await testConnection();
  
  if (!dbConnected) {
    console.log('❌ Server dihentikan karena database tidak terhubung');
    process.exit(1);
  }

  const PORT = process.env.PORT || 3001;
  
  // Create server instance
  const server = Hapi.server({
    port: PORT,
    host: 'localhost',
    routes: {
      cors: {
        origin: ['*'],
        credentials: true
      }
    }
  });

  // Basic route untuk test
  server.route({
    method: 'GET',
    path: '/',
    handler: (request, h) => {
      return {
        status: 'success',
        message: '🚀 LasalleServe Backend API is running!',
        database: 'PostgreSQL ✅',
        timestamp: new Date().toISOString(),
        port: PORT
      };
    }
  });

  // Health check route
  server.route({
    method: 'GET',
    path: '/health',
    handler: async (request, h) => {
      const { query } = require('./config/database');
      
      try {
        const result = await query('SELECT NOW() as current_time');
        return {
          status: 'success',
          message: '✅ LasalleServe Server is healthy',
          database: {
            status: 'connected ✅',
            current_time: result.rows[0].current_time
          },
          server_time: new Date().toISOString(),
          port: PORT
        };
      } catch (error) {
        return {
          status: 'error',
          message: '❌ Server has issues',
          error: error.message
        };
      }
    }
  });

  // Database test route
  server.route({
    method: 'GET',
    path: '/test-db',
    handler: async (request, h) => {
      const { query } = require('./config/database');
      
      try {
        const result = await query('SELECT version() as postgres_version');
        return {
          status: 'success',
          message: '✅ Database connection successful!',
          database: {
            name: process.env.DB_NAME,
            version: result.rows[0].postgres_version,
            status: 'active ✅'
          },
          port: PORT
        };
      } catch (error) {
        return {
          status: 'error',
          message: '❌ Database connection failed!',
          error: error.message
        };
      }
    }
  });

  try {
    await server.start();
    console.log('\n🎉 LASALLESERVE BACKEND BERHASIL DIJALANKAN!');
    console.log('📍 Server URL:', server.info.uri);
    console.log('\n📚 Endpoints yang tersedia:');
    console.log('   ✅ GET  /          - Main API');
    console.log('   ✅ GET  /health    - Health check');
    console.log('   ✅ GET  /test-db   - Test database');
    console.log('\n🌐 Test di browser:');
    console.log('   ', server.info.uri);
    console.log('   ', server.info.uri + '/health');
    console.log('   ', server.info.uri + '/test-db');
  } catch (error) {
    if (error.code === 'EADDRINUSE') {
      console.error('\n❌ PORT SUDAH DIGUNAKAN!');
      console.error(`   Port ${PORT} sedang digunakan oleh aplikasi lain.`);
      console.error('\n🔧 SOLUSI:');
      console.error('   1. Ganti PORT di file .env menjadi 3002, 3003, dll.');
      console.error('   2. Atau kill process yang menggunakan port tersebut:');
      console.error('      netstat -ano | findstr :' + PORT);
      console.error('      taskkill /PID <PID_NUMBER> /F');
    } else {
      console.error('❌ Gagal menjalankan server:', error.message);
    }
    process.exit(1);
  }
};

process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled rejection:', err);
  process.exit(1);
});

init();