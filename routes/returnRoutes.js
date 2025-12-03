// routes/returnRoutes.js
const Joi = require('joi');
const ReturnController = require('../controllers/returnController');
const { checkRole } = require('../middleware/auth');

const returnRoutes = [
  {
    method: 'GET',
    path: '/api/returns/pending',
    handler: ReturnController.getPendingReturns
  },
  {
    method: 'GET',
    path: '/api/returns/history',
    handler: ReturnController.getReturnHistory
  },
  {
    method: 'POST',
    path: '/api/returns/{loanId}/process',
    options: {
      pre: [{ method: checkRole(['staf_buf', 'admin_buf']) }],
      validate: {
        payload: Joi.object({
          returnedItems: Joi.array().items(
            Joi.object({
              id: Joi.string().required(),
              name: Joi.string().required(),
              quantity: Joi.number().integer().min(1).required(),
              condition: Joi.string().valid('baik', 'rusak_ringan', 'rusak_berat', 'hilang').required()
            })
          ).required(),
          notes: Joi.string().allow('')
        })
      }
    },
    handler: ReturnController.processReturn
  }
];

module.exports = returnRoutes;