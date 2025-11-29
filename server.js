// server.js - FIXED VERSION
const Hapi = require('@hapi/hapi');
require('dotenv').config();

const init = async () => {
  console.log('🔄 Starting LasalleServe Backend...');
  
  // Test database connection first
  console.log('🔍 Testing database connection...');
  const { testConnection } = require('./config/database');
  const dbConnected = await testConnection();
  
  if (!dbConnected) {
    console.log('⚠️  Continuing without database connection for testing...');
    // Jangan exit, lanjutkan untuk testing routes
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

  // Register routes
  try {
    const routes = require('./routes');
    server.route(routes);
    console.log('✅ Routes registered successfully');
  } catch (error) {
    console.error('❌ Error registering routes:', error.message);
  }

  // Basic route untuk test
  server.route({
    method: 'GET',
    path: '/',
    handler: (request, h) => {
      return {
        status: 'success',
        message: '🚀 LasalleServe Backend API is running!',
        database: dbConnected ? 'PostgreSQL ✅' : 'PostgreSQL ❌ (Test Mode)',
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
          server_time: new Date().toISOString()
        };
      } catch (error) {
        return {
          status: 'success',
          message: '⚠️ Server running in test mode',
          database: {
            status: 'disconnected ❌',
            error: error.message
          },
          server_time: new Date().toISOString()
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
    console.log('   ✅ POST /api/auth/register - Register user');
    console.log('   ✅ POST /api/auth/login    - Login user');
    console.log('   ✅ GET  /api/assets        - Get assets');
  } catch (error) {
    console.error('❌ Gagal menjalankan server:', error);
    process.exit(1);
  }
};

process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled rejection:', err);
  process.exit(1);
});

init();