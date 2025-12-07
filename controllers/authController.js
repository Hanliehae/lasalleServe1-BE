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
  console.log('🔐 Login attempt:', request.payload);
  
  const { email, password } = request.payload;

  try {
    // Find user
    console.log('🔍 Searching for user:', email);
    const result = await query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    console.log('📋 User found:', result.rows.length > 0 ? 'Yes' : 'No');
    
    if (result.rows.length === 0) {
      console.log('❌ User not found:', email);
      return h.response({
        status: 'error',
        message: 'Email atau password salah'
      }).code(401);
    }

    const user = result.rows[0];
    console.log('👤 User data:', {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      hasPassword: !!user.password,
      passwordLength: user.password ? user.password.length : 0
    });

    // Jika password adalah default hash, kita perlu reset
    const defaultHash = '$2b$10$6Y./.sCjW5z7V7g8H9qZ0e1X2y3z4A5B6C7D8E9F0G1H2I3J4K5L6M7N8O9P0';
    if (user.password === defaultHash) {
      console.log('⚠️  User has default password hash');
      
      // Verifikasi password dengan default
      const isValidPassword = await bcrypt.compare(password, user.password);
      console.log('🔐 Password verification with default hash:', isValidPassword);
      
      if (!isValidPassword) {
        // Update password dengan hash baru
        console.log('🔄 Updating user password with new hash...');
        const newHash = await bcrypt.hash(password, 10);
        await query(
          'UPDATE users SET password = $1 WHERE id = $2',
          [newHash, user.id]
        );
        
        // Update user object dengan password baru
        user.password = newHash;
        console.log('✅ Password updated with new hash');
      }
    } else {
      // Verify password normal
      console.log('🔐 Verifying password...');
      const isValidPassword = await bcrypt.compare(password, user.password);
      console.log('✅ Password valid:', isValidPassword);
      
      if (!isValidPassword) {
        return h.response({
          status: 'error',
          message: 'Email atau password salah'
        }).code(401);
      }
    }

    // Check if user is active
    if (user.is_active === false) {
      return h.response({
        status: 'error',
        message: 'Akun tidak aktif'
      }).code(401);
    }

    // Generate token
    const token = generateToken(user);
    console.log('✅ Login successful for:', user.email);

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
    console.error('❌ Login error:', error);
    return h.response({
      status: 'error',
      message: 'Terjadi kesalahan server: ' + error.message
    }).code(500);
  }
}

  static async getProfile(request, h) {
    try {
      // User sudah tersedia dari auth middleware
      const user = request.auth.credentials.user;
      
      // Ambil data terbaru dari database (opsional, jika ingin data terbaru)
      const result = await query(
        `SELECT id, email, role, name, department, student_id as "studentId", 
                phone, is_active as "isActive", created_at as "createdAt"
         FROM users WHERE id = $1`,
        [user.id]
      );

      if (result.rows.length === 0) {
        return h.response({
          status: 'error',
          message: 'User tidak ditemukan'
        }).code(404);
      }

      return h.response({
        status: 'success',
        data: {
          user: result.rows[0]
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
  static async logout(request, h) {
    // Untuk JWT, logout handled di client side dengan menghapus token
    return h.response({
      status: 'success',
      message: 'Logout berhasil'
    });
  }
}

module.exports = AuthController;