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
          totalStock: Joi.number().integer().min(0).required(),
          availableStock: Joi.number().integer().min(0).required(),
          condition: Joi.string().valid('baik', 'rusak_ringan', 'rusak_berat').required(),
          description: Joi.string().allow(''),
          acquisitionYear: Joi.string().allow('')
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
          totalStock: Joi.number().integer().min(0).required(),
          availableStock: Joi.number().integer().min(0).required(),
          condition: Joi.string().valid('baik', 'rusak_ringan', 'rusak_berat').required(),
          description: Joi.string().allow(''),
          acquisitionYear: Joi.string().allow('')
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
  }
];

module.exports = assetRoutes;