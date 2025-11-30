// utils/jwt.js - SIMPLIFIED VERSION
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'lasalleserve-dev-secret-2024';

const generateToken = (user) => {
  console.log('🔐 Generating token for user:', user.email);
  
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    iat: Math.floor(Date.now() / 1000), // issued at
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
  };

  try {
    const token = jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256' });
    console.log('✅ Token generated successfully, length:', token.length);
    return token;
  } catch (error) {
    console.error('❌ Token generation error:', error);
    throw error;
  }
};

const verifyToken = (token) => {
  try {
    console.log('🔍 Verifying token...');
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('✅ Token verified successfully for user:', decoded.email);
    return decoded;
  } catch (error) {
    console.error('❌ Token verification error:', error.message);
    throw error;
  }
};

module.exports = { generateToken, verifyToken };