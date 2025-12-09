// config/cloudinary.js
const cloudinary = require('cloudinary').v2;
require('dotenv').config();

cloudinary.config({
  cloud_name: 'npbiizrj',
  api_key: '282253774349',
  api_secret: '********************************',

  secure: true,
});

module.exports = cloudinary;