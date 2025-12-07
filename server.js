// server.js - PERBAIKAN COMPLETE
const Hapi = require('@hapi/hapi');
const HapiJwt = require('@hapi/jwt');
require('dotenv').config();
const { startCronJobs } = require('./utils/cron');

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
        origin: ['http://localhost:3000', 'http://localhost:5173'],
        credentials: true
      },
      validate: {
        failAction: async (request, h, err) => {
          console.error('Validation error:', err.message);
          return h.response({
            status: 'error',
            message: err.message
          }).code(400).takeover();
        }
      }
    }
  });

  // ✅ REGISTER JWT PLUGIN
  await server.register(HapiJwt);

  // ✅ DEFINE JWT STRATEGY - SIMPLIFIED
  server.auth.strategy('jwt', 'jwt', {
    keys: process.env.JWT_SECRET || 'lasalleserve-dev-secret-2024',
    verify: {
      aud: false,
      iss: false,
      sub: false,
      nbf: false,
      exp: true,
      maxAgeSec: 14400,
      timeSkewSec: 15
    },
    validate: async (artifacts, request, h) => {
      try {
        const payload = artifacts.decoded.payload;
        
        return {
          isValid: true,
          credentials: { 
            user: payload,
            scope: payload.role 
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
        port: PORT,
        version: '1.0.0',
        endpoints: {
          auth: '/api/auth',
          assets: '/api/assets',
          loans: '/api/loans',
          dashboard: '/api/dashboard',
          reports: '/api/damage-reports',
          returns: '/api/returns',
          export: '/api/export',
          upload: '/api/upload'
        }
      };
    }
  });

  // Test endpoint untuk debug token
  server.route({
    method: 'GET',
    path: '/api/debug/token',
    handler: (request, h) => {
      const user = request.auth.credentials.user;
      return {
        status: 'success',
        data: {
          user: user,
          headers: request.headers,
          auth: request.auth
        }
      };
    }
  });

  // Test endpoint untuk assets dengan debug
  server.route({
    method: 'GET',
    path: '/api/debug/assets',
    handler: async (request, h) => {
      const { query } = require('./config/database');
      try {
        const result = await query('SELECT * FROM assets LIMIT 5');
        return {
          status: 'success',
          data: {
            count: result.rows.length,
            assets: result.rows
          }
        };
      } catch (error) {
        return {
          status: 'error',
          message: error.message
        };
      }
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
        
        // Cek semua tabel
        const tables = await query(`
          SELECT table_name, 
                 (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
          FROM information_schema.tables t
          WHERE t.table_schema = 'public'
          ORDER BY table_name
        `);
        
        return {
          status: 'success',
          message: '✅ LasalleServe Server is healthy',
          database: {
            status: 'connected ✅',
            current_time: result.rows[0].current_time,
            tables: tables.rows
          },
          server_time: new Date().toISOString(),
          environment: process.env.NODE_ENV || 'development'
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
    console.log('   ✅ GET  /                    - Main API');
    console.log('   ✅ GET  /health              - Health check');
    console.log('   ✅ GET  /api/debug/token     - Debug token');
    console.log('   ✅ GET  /api/debug/assets    - Debug assets');
    console.log('   ✅ POST /api/auth/register   - Register user');
    console.log('   ✅ POST /api/auth/login      - Login user');
    console.log('   ✅ GET  /api/assets          - Get assets');
    console.log('   ✅ POST /api/assets          - Create asset');
    console.log('\n🔑 Token testing user: admin@buf.ac.id');
    
    // ✅ Start cron jobs setelah server running
    startCronJobs();
    
    return server; // ✅ Kembalikan server instance
    
  } catch (error) {
    console.error('❌ Gagal menjalankan server:', error);
    process.exit(1);
  }
};

// Handler untuk unhandled rejections
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled rejection:', err);
  process.exit(1);
});

// Jalankan server
init().then(server => {
  console.log(`✅ Server berjalan di ${server.info.uri}`);
}).catch(err => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});