// routes/assetRoutes.js
const Joi = require('joi');
const AssetController = require('../controllers/assetController');
const { checkRole } = require('../middleware/auth');

const assetRoutes = [
  {
    method: 'GET',
    path: '/api/assets',
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
          conditions: Joi.array().items(
            Joi.object({
              condition: Joi.string().valid('baik', 'rusak_ringan', 'rusak_berat').required(),
              quantity: Joi.number().integer().min(0).required()
            })
          ).required(),
          description: Joi.string().allow(''),
          acquisitionYear: Joi.string().allow('')
        })
      }
    },
    handler: AssetController.createAsset
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
          conditions: Joi.array().items(
            Joi.object({
              condition: Joi.string().valid('baik', 'rusak_ringan', 'rusak_berat').required(),
              quantity: Joi.number().integer().min(0).required()
            })
          ).required(),
          description: Joi.string().allow(''),
          acquisitionYear: Joi.string().allow('')
        })
      }
    },
    handler: AssetController.createAsset
  },
  {
    method: 'DELETE',
    path: '/api/assets/{id}',
    options: {
      pre: [{ method: checkRole(['admin_buf']) }]
    },
    handler: AssetController.deleteAsset
  }
];

module.exports = assetRoutes;