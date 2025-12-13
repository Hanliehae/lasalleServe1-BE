
const Joi = require('joi');
const ReportController = require('../controllers/reportController');
const { checkRole } = require('../middleware/auth');

const reportRoutes = [
  {
    method: 'GET',
    path: '/api/damage-reports',
    handler: ReportController.getDamageReports
  },
  {
    method: 'GET',
    path: '/api/damage-reports/{id}',
    handler: ReportController.getDamageReportById
  },
  {
    method: 'POST',
    path: '/api/damage-reports',
    options: {
      validate: {
        payload: Joi.object({
          assetId: Joi.string().required(),
          description: Joi.string().required(),
          priority: Joi.string().valid('rendah', 'sedang', 'tinggi').required(),
          photoUrl: Joi.string().allow(''),
          notes: Joi.string().allow('')
        })
      }
    },
    handler: ReportController.createDamageReport
  },
  {
    method: 'PUT',
    path: '/api/damage-reports/{id}',
    options: {
      pre: [{ method: checkRole(['admin_buf', 'kepala_buf']) }], // admin_buf dan kepala_buf
      validate: {
        payload: Joi.object({
          status: Joi.string().valid('menunggu', 'dalam_perbaikan', 'selesai'),
          priority: Joi.string().valid('rendah', 'sedang', 'tinggi'),
          notes: Joi.string().allow('')
        }).min(1) // Minimal satu field harus diisi
      }
    },
    handler: ReportController.updateDamageReport
  },
  {
    method: 'DELETE',
    path: '/api/damage-reports/{id}',
    options: {
      pre: [{ method: checkRole(['admin_buf', 'kepala_buf']) }] // admin_buf dan kepala_buf
    },
    handler: ReportController.deleteDamageReport
  }
];

module.exports = reportRoutes;