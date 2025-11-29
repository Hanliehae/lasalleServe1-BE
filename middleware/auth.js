const { query } = require('../config/database');

const authenticateJWT = async (artifacts, request, h) => {
  const { id, email } = artifacts.decoded.payload;
  
  try {
    // Cek apakah user masih ada dan aktif
    const result = await query(
      'SELECT id, email, role, name FROM users WHERE id = $1 AND is_active = true',
      [id]
    );

    if (result.rows.length === 0) {
      return { isValid: false };
    }

    const user = result.rows[0];

    return {
      isValid: true,
      credentials: { user }
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