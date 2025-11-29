// routes/auth.js - PERBAIKI schema validation
const Joi = require('joi');
const AuthController = require('../controllers/authController');

const authRoutes = [
  {
    method: 'POST',
    path: '/api/auth/register',
    options: {
      auth: false,
      validate: {
        payload: Joi.object({
          name: Joi.string().required(),
          email: Joi.string().email().required(),
          password: Joi.string().min(6).required(),
          role: Joi.string().valid('mahasiswa', 'dosen', 'staf', 'civitas').required(),
          department: Joi.string().allow('').optional(),
          studentId: Joi.string().allow('').optional(), // Ubah menjadi optional
          phone: Joi.string().allow('').optional(),
          ktmUrl: Joi.string().allow('').optional()
        }).options({ stripUnknown: true }) // TAMBAHKAN ini untuk remove field yang tidak di-defined
      }
    },
    handler: AuthController.register
  },
  {
    method: 'POST',
    path: '/api/auth/login',
    options: {
      auth: false,
      validate: {
        payload: Joi.object({
          email: Joi.string().email().required(),
          password: Joi.string().required()
        })
      }
    },
    handler: AuthController.login
  },
  {
    method: 'POST',
    path: '/api/auth/logout',
    handler: AuthController.logout
  },
  {
    method: 'GET',
    path: '/api/auth/me',
    handler: AuthController.getProfile
  }
];

module.exports = authRoutes;