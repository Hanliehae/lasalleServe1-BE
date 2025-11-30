// server.js - PERBAIKI BAGIAN INI
const Hapi = require('@hapi/hapi');
const HapiJwt = require('@hapi/jwt'); // TAMBAHKAN INI
require('dotenv').config();

const init = async () => {
  console.log('🔄 Starting LasalleServe Backend...');
  
  // Test database connection first
  console.log('🔍 Testing database connection...');
  const { testConnection } = require('./config/database');
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

  // ✅ REGISTER JWT PLUGIN - FIX VERSION
  await server.register(HapiJwt);

   // ✅ DEFINE JWT STRATEGY - SIMPLIFIED
  server.auth.strategy('jwt', 'jwt', {
    keys: process.env.JWT_SECRET || 'fallback-secret-key-untuk-development',
    verify: {
      aud: false,
      iss: false,
      sub: false,
      nbf: false,
      exp: true,
      maxAgeSec: 14400, // 4 hours
      timeSkewSec: 15
    },
    validate: async (artifacts, request, h) => {
      try {
        const { query } = require('./config/database');
        const payload = artifacts.decoded.payload;
        const userId = payload.id;
        
        // Cek user di database
        const result = await query(
          'SELECT id, email, role, name, is_active FROM users WHERE id = $1 AND is_active = true',
          [userId]
        );

        if (result.rows.length === 0) {
          return { isValid: false };
        }

        return {
          isValid: true,
          credentials: { 
            user: result.rows[0],
            scope: result.rows[0].role 
          }
        };
      } catch (error) {
        console.error('Auth validation error:', error);
        return { isValid: false };
      }
    }
  });

  // Set default auth strategy
  server.auth.default('jwt');

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
    options: { auth: false },
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
    options: { auth: false },
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
          status: 'error',
          message: '❌ Database error',
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