// controllers/authController.js - TAMBAHKAN debugging
const bcrypt = require('bcrypt');
const { query } = require('../config/database');
const { generateToken } = require('../utils/jwt');

class AuthController {
  static async register(request, h) {
    console.log('📝 Register request received:', request.payload); // DEBUG
    
    const {
      name,
      email,
      password,
      role,
      department,
      studentId,
      phone,
      ktmUrl
    } = request.payload;

    try {
      // Check if user exists
      console.log('🔍 Checking if user exists:', email);
      const existingUser = await query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );

      if (existingUser.rows.length > 0) {
        console.log('❌ User already exists:', email);
        return h.response({
          status: 'error',
          message: 'Email sudah terdaftar'
        }).code(400);
      }

      // Hash password
      console.log('🔐 Hashing password...');
      const hashedPassword = await bcrypt.hash(password, 10);

      // Insert user
      console.log('💾 Inserting user into database...');
      const result = await query(
        `INSERT INTO users (name, email, password, role, department, student_id, phone, ktm_url) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
         RETURNING id, name, email, role, department, student_id, phone, ktm_url, created_at`,
        [name, email, hashedPassword, role, department, studentId, phone, ktmUrl]
      );

      const user = result.rows[0];
      const token = generateToken(user);

      console.log('✅ User registered successfully:', user.email);
      
      return h.response({
        status: 'success',
        data: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            department: user.department,
            studentId: user.student_id,
            phone: user.phone,
            ktmUrl: user.ktm_url
          },
          token
        }
      }).code(201);
    } catch (error) {
      console.error('❌ Registration error:', error);
      return h.response({
        status: 'error',
        message: 'Terjadi kesalahan server'
      }).code(500);
    }
  }



  static async login(request, h) {
    const { email, password } = request.payload;

    try {
      // Find user
      const result = await query(
        'SELECT * FROM users WHERE email = $1 AND is_active = true',
        [email]
      );

      if (result.rows.length === 0) {
        return h.response({
          status: 'error',
          message: 'Email atau password salah'
        }).code(401);
      }

      const user = result.rows[0];

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return h.response({
          status: 'error',
          message: 'Email atau password salah'
        }).code(401);
      }

      // Generate token
      const token = generateToken(user);

      return h.response({
        status: 'success',
        data: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            department: user.department,
            studentId: user.student_id,
            phone: user.phone,
            ktmUrl: user.ktm_url
          },
          token
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      return h.response({
        status: 'error',
        message: 'Terjadi kesalahan server'
      }).code(500);
    }
  }

  static async logout(request, h) {
    // In a real application, you might want to blacklist the token
    return h.response({
      status: 'success',
      message: 'Logout berhasil'
    });
  }

  static async getProfile(request, h) {
    const userId = request.auth.credentials.user.id;

    try {
      const result = await query(
        'SELECT id, name, email, role, department, student_id, phone, ktm_url, created_at FROM users WHERE id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        return h.response({
          status: 'error',
          message: 'User tidak ditemukan'
        }).code(404);
      }

      const user = result.rows[0];

      return h.response({
        status: 'success',
        data: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            department: user.department,
            studentId: user.student_id,
            phone: user.phone,
            ktmUrl: user.ktm_url
          }
        }
      });
    } catch (error) {
      console.error('Get profile error:', error);
      return h.response({
        status: 'error',
        message: 'Terjadi kesalahan server'
      }).code(500);
    }
  }
}

module.exports = AuthController;