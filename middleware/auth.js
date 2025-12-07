// middleware/auth.js
const { verifyToken } = require('../utils/jwt');

const authenticate = async (request, h) => {
  try {
    const authHeader = request.headers.authorization;
    
    if (!authHeader) {
      return h.response({
        status: 'error',
        message: 'Token tidak ditemukan'
      }).code(401).takeover();
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = verifyToken(token);
    
    // Tambahkan user ke credentials
    request.auth = {
      credentials: {
        user: decoded,
        scope: decoded.role
      }
    };

    return h.continue;
  } catch (error) {
    console.error('Auth error:', error.message);
    return h.response({
      status: 'error',
      message: 'Token tidak valid'
    }).code(401).takeover();
  }
};

const checkRole = (allowedRoles) => {
  return (request, h) => {
    const user = request.auth.credentials.user;
    
    if (!allowedRoles.includes(user.role)) {
      return h.response({
        status: 'error',
        message: 'Anda tidak memiliki izin untuk mengakses fitur ini'
      }).code(403).takeover();
    }

    return h.continue;
  };
};

module.exports = { authenticate, checkRole };