// routes/loansRoutes.js - PERBAIKI
const Joi = require('joi');
const LoanController = require('../controllers/loanController');
const { checkRole } = require('../middleware/auth');

const loanRoutes = [
  {
    method: 'GET',
    path: '/api/loans',
    options: {
      validate: {
        query: Joi.object({
          search: Joi.string().allow(''),
          status: Joi.string().valid('menunggu', 'disetujui', 'ditolak', 'selesai', 'menunggu_pengembalian', 'all').default('all'),
          academicYear: Joi.string().allow(''),
          semester: Joi.string().valid('ganjil', 'genap', 'all').default('all')
        })
      }
    },
    handler: LoanController.getLoans
  },
  {
    method: 'GET',
    path: '/api/loans/{id}',
    handler: LoanController.getLoanById
  },
  {
    method: 'POST',
    path: '/api/loans',
    options: {
      validate: {
        payload: Joi.object({
          roomId: Joi.string().allow(null),
          facilities: Joi.array().items(
            Joi.object({
              id: Joi.string().required(),
              quantity: Joi.number().integer().min(1).required()
            })
          ).min(1).required(),
          startDate: Joi.date().required(),
          endDate: Joi.date().required(),
          startTime: Joi.string().allow(''),
          endTime: Joi.string().allow(''),
          purpose: Joi.string().required(),
          academicYear: Joi.string().required(),
          semester: Joi.string().valid('ganjil', 'genap').required(),
           attachmentUrl: Joi.string().allow(null, '')
        })
      }
    },
    handler: LoanController.createLoan
  },
  {
    method: 'PUT',
    path: '/api/loans/{id}/status',
    options: {
      pre: [{ method: checkRole(['staf_buf', 'admin_buf']) }],
      validate: {
        payload: Joi.object({
          status: Joi.string().valid('disetujui', 'ditolak', 'menunggu_pengembalian', 'selesai').required(),
          notes: Joi.string().allow('').optional()
        })
      }
    },
    handler: LoanController.updateLoanStatus
  },
  {
    method: 'DELETE',
    path: '/api/loans/{id}',
    handler: LoanController.deleteLoan
  }
];

module.exports = loanRoutes;