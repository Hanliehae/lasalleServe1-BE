// routes/assetRoutes.js - PERBAIKI
const Joi = require('joi');
const AssetController = require('../controllers/assetController');
const { checkRole } = require('../middleware/auth');

const assetRoutes = [
  {
    method: 'GET',
    path: '/api/assets',
    options: {
      validate: {
        query: Joi.object({
          search: Joi.string().allow(''),
          category: Joi.string().valid('ruangan', 'fasilitas', 'all').default('all'),
          availableOnly: Joi.boolean().default(false)
        })
      }
    },
    handler: AssetController.getAssets
  },
  {
    method: 'GET',
    path: '/api/assets/{id}',
    handler: AssetController.getAssetById
  },
  {
    method: 'POST',
    path: '/api/assets',
    options: {
      pre: [{ method: checkRole(['admin_buf']) }],
      validate: {
        payload: Joi.object({
          name: Joi.string().required(),
          category: Joi.string().valid('ruangan', 'fasilitas').required(),
          location: Joi.string().required(),
          description: Joi.string().allow(''),
          acquisitionYear: Joi.string().allow(''),
          semester: Joi.string().allow(''),
          conditions: Joi.array().items(
            Joi.object({
              condition: Joi.string().valid('baik', 'rusak_ringan', 'rusak_berat').required(),
              quantity: Joi.number().integer().min(0).required()
            })
          ).required()
        })
      }
    },
    handler: AssetController.createAsset
  },
  {
    method: 'PUT',
    path: '/api/assets/{id}',
    options: {
      pre: [{ method: checkRole(['admin_buf']) }],
      validate: {
        payload: Joi.object({
          name: Joi.string().required(),
          category: Joi.string().valid('ruangan', 'fasilitas').required(),
          location: Joi.string().required(),
          description: Joi.string().allow(''),
          acquisitionYear: Joi.string().allow(''),
          semester: Joi.string().allow(''),
          conditions: Joi.array().items(
            Joi.object({
              condition: Joi.string().valid('baik', 'rusak_ringan', 'rusak_berat').required(),
              quantity: Joi.number().integer().min(0).required()
            })
          ).required()
        })
      }
    },
    handler: AssetController.updateAsset
  },
  {
    method: 'DELETE',
    path: '/api/assets/{id}',
    options: {
      pre: [{ method: checkRole(['admin_buf']) }]
    },
    handler: AssetController.deleteAsset
  },
  {
    method: 'GET',
    path: '/api/assets/{id}/check-stock',
    options: {
      validate: {
        query: Joi.object({
          quantity: Joi.number().integer().min(1).required()
        })
      }
    },
    handler: AssetController.checkStockAvailability
  }
];

module.exports = assetRoutes;