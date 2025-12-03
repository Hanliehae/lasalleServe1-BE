// routes/exportRoutes.js
const Joi = require('joi');
const ExportController = require('../controllers/exportController');
const { checkRole } = require('../middleware/auth');

const exportRoutes = [
  {
    method: 'GET',
    path: '/api/export/loans',
    options: {
      pre: [{ method: checkRole(['admin_buf', 'kepala_buf']) }],
      validate: {
        query: Joi.object({
          academicYear: Joi.string().allow(''),
          semester: Joi.string().valid('ganjil', 'genap', 'all').default('all'),
          format: Joi.string().valid('json', 'csv').default('json')
        })
      }
    },
    handler: ExportController.exportLoans
  },
  {
    method: 'GET',
    path: '/api/export/damage-reports',
    options: {
      pre: [{ method: checkRole(['admin_buf', 'kepala_buf']) }],
      validate: {
        query: Joi.object({
          academicYear: Joi.string().allow(''),
          semester: Joi.string().valid('ganjil', 'genap', 'all').default('all'),
          format: Joi.string().valid('json', 'csv').default('json')
        })
      }
    },
    handler: ExportController.exportDamageReports
  }
];

module.exports = exportRoutes;