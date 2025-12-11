// server.js - PERBAIKI DENGAN DEBUGGING
const Hapi = require('@hapi/hapi');
const HapiJwt = require('@hapi/jwt');
require('dotenv').config();

const init = async () => {
  console.log('🔄 Starting LasalleServe Backend...');
  console.log('📁 Current directory:', __dirname);
  console.log('📦 Loading environment variables...');
  
  // Debug environment variables
  console.log('\n🔧 ENVIRONMENT VARIABLES:');
  console.log('PORT:', process.env.PORT);
  console.log('DB_HOST:', process.env.DB_HOST);
  console.log('DB_NAME:', process.env.DB_NAME);
  console.log('DB_USER:', process.env.DB_USER);
  console.log('DB_PASSWORD type:', typeof process.env.DB_PASSWORD);
  console.log('DB_PASSWORD length:', process.env.DB_PASSWORD ? process.env.DB_PASSWORD.length : 'NULL');
  console.log('JWT_SECRET:', process.env.JWT_SECRET ? '***configured***' : '❌ MISSING');
  
  // Test database connection with timeout
  console.log('\n🔍 Testing database connection...');
  try {
    const { testConnection } = require('./config/database');
    
    // Set timeout untuk test koneksi
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database connection timeout after 10s')), 10000)
    );
    
    const dbPromise = testConnection();
    const dbConnected = await Promise.race([dbPromise, timeoutPromise]);
    
    if (!dbConnected) {
      console.log('❌ Database connection failed but continuing for testing...');
      // Jangan exit, biarkan server tetap berjalan untuk testing
    } else {
      console.log('✅ Database connection successful!');
    }
  } catch (error) {
    console.error('⚠️ Database connection error:', error.message);
    console.log('⚠️ Server will continue without database connection (for testing)...');
  }

  const PORT = process.env.PORT || 3001;
  
  // Create server instance
  const server = Hapi.server({
    port: PORT,
    host: 'localhost', // GANTI dari 'localhost' ke '0.0.0.0'
    routes: {
      cors: {
        origin: ['*'],
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

  // ✅ REGISTER JWT PLUGIN dengan error handling
  try {
    await server.register(HapiJwt);
    console.log('✅ JWT plugin registered successfully');
  } catch (jwtError) {
    console.error('❌ JWT plugin registration failed:', jwtError.message);
    // Lanjut tanpa JWT untuk testing
  }

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

  // Register routes dengan error handling
  try {
    const routes = require('./routes');
    server.route(routes);
    console.log('✅ Routes registered successfully');
  } catch (error) {
    console.error('❌ Error registering routes:', error.message);
    console.error('Error stack:', error.stack);
  }

  // ============================================
  // ROUTES UTAMA DENGAN ERROR HANDLING
  // ============================================

  // Basic route untuk test
  server.route({
    method: 'GET',
    path: '/',
    options: { auth: false },
    handler: (request, h) => {
      return {
        status: 'success',
        message: '🚀 LasalleServe Backend API is running!',
        database: 'PostgreSQL',
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

 



  // Health check dengan database status
  server.route({
    method: 'GET',
    path: '/health',
    options: { auth: false },
    handler: async (request, h) => {
      let dbStatus = 'unknown';
      try {
        const { query } = require('./config/database');
        const result = await query('SELECT NOW() as current_time');
        dbStatus = 'connected';
      } catch (error) {
        dbStatus = 'disconnected: ' + error.message;
      }
      
      return {
        status: 'success',
        message: '✅ LasalleServe Server is running',
        server_time: new Date().toISOString(),
        port: PORT,
        database: dbStatus,
        environment: process.env.NODE_ENV || 'development'
      };
    }
  });

  // Test endpoint tanpa database
  server.route({
    method: 'GET',
    path: '/api/test',
    options: { auth: false },
    handler: (request, h) => {
      return {
        status: 'success',
        message: 'Server is working!',
        timestamp: new Date().toISOString()
      };
    }
  });

  // ============================================
  // START SERVER DENGAN ERROR HANDLING
  // ============================================
  
  try {
    await server.start();
    console.log('\n🎉 LASALLESERVE BACKEND BERHASIL DIJALANKAN!');
    console.log('📍 Server URL:', server.info.uri);
    console.log('📍 Local URL: http://localhost:' + PORT);
    console.log('\n📚 Test Endpoints:');
    console.log('   ✅ GET  http://localhost:' + PORT + '/');
    console.log('   ✅ GET  http://localhost:' + PORT + '/health');
    console.log('   ✅ POST http://localhost:' + PORT + '/api/auth/login');
    console.log('   ✅ POST http://localhost:' + PORT + '/api/auth/register');
    console.log('   ✅ GET  http://localhost:' + PORT + '/api/test');
    console.log('\n🔑 Demo Users:');
    console.log('   👤 Admin: admin@buf.ac.id / admin123');
    console.log('   👤 Staf: staf@buf.ac.id / staf123');
    console.log('   👤 Mahasiswa: mahasiswa@student.ac.id / mhs123');
    
    return server;
    
  } catch (error) {
    console.error('❌ Gagal menjalankan server:', error);
    console.error('Error details:', error.stack);
    
    // Coba start di port alternatif
    console.log('\n🔄 Trying alternative port 3002...');
    try {
      server.settings.port = 3002;
      await server.start();
      console.log('✅ Server running on port 3002:', server.info.uri);
      return server;
    } catch (altError) {
      console.error('❌ Failed to start on port 3002:', altError.message);
      process.exit(1);
    }
  }
};

// Handler untuk unhandled rejections
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled rejection:', err.message);
  console.error('Stack:', err.stack);
  // Jangan exit, biarkan server tetap berjalan
});

process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('👋 SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

// Jalankan server
init().then(server => {
  console.log(`\n✅ Server berjalan di ${server.info.uri}`);
  console.log(`✅ Press Ctrl+C to stop\n`);
}).catch(err => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});