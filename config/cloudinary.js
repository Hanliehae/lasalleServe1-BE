// config/cloudinary.js - PERBAIKI VERSION
require('dotenv').config();  // Pastikan ini di baris PERTAMA!

const cloudinary = require('cloudinary').v2;

// Validasi environment variables
const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

// Debug log (tapi jangan expose secret di production)
console.log('☁️ Cloudinary Configuration Check:');
console.log('  Cloud Name:', cloudName ? '***' + cloudName.slice(-4) : '❌ MISSING');
console.log('  API Key:', apiKey ? '***' + apiKey.slice(-4) : '❌ MISSING');
console.log('  API Secret:', apiSecret ? '***configured***' : '❌ MISSING');

// Validasi minimal
if (!cloudName || !apiKey || !apiSecret) {
  console.error('❌ CLOUDINARY ERROR: Missing configuration in .env file');
  console.error('   Please set: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET');
  
  // Mode development: mock cloudinary untuk testing
  module.exports = {
    uploader: {
      upload_stream: (options, callback) => {
        console.warn('⚠️ Cloudinary not configured, using mock uploader');
        callback(null, {
          secure_url: 'https://via.placeholder.com/600x400/cccccc/969696?text=Mock+Upload',
          public_id: 'mock_' + Date.now(),
          format: 'jpg'
        });
      },
      destroy: () => Promise.resolve({ result: 'ok' })
    },
    config: () => ({})
  };
  return;
}

// Konfigurasi asli
try {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
  
  console.log('✅ Cloudinary configured successfully');
} catch (error) {
  console.error('❌ Cloudinary configuration error:', error.message);
  throw error;
}

module.exports = cloudinary;