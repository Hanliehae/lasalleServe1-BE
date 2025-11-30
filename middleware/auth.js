// middleware/auth.js - COMPATIBLE WITH @hapi/jwt v3
const { query } = require('../config/database');
const { verifyToken } = require('../utils/jwt');

const authenticateJWT = async (artifacts, request, h) => {
  try {
    const decoded = artifacts.decoded;
    const userId = decoded.payload.id;
    
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
    console.error('Auth error:', error);
    return { isValid: false };
  }
};

const checkRole = (roles) => {
  return (request, h) => {
    const userRole = request.auth.credentials.user.role;
    if (!roles.includes(userRole)) {
      return h.response({
        status: 'error',
        message: 'Unauthorized access'
      }).code(403);
    }
    return h.continue;
  };
};

module.exports = { authenticateJWT, checkRole };