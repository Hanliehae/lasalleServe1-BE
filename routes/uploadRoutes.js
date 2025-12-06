// routes/uploadRoutes.js
const UploadController = require('../controllers/uploadController');
const { checkRole } = require('../middleware/auth');

const uploadRoutes = [
  {
    method: 'POST',
    path: '/api/upload',
    options: {
      payload: {
        maxBytes: 10 * 1024 * 1024, // 10MB
        output: 'stream',
        parse: true,
        multipart: true,
        allow: 'multipart/form-data'
      },
      pre: [{ method: checkRole(['mahasiswa', 'dosen', 'staf', 'staf_buf', 'admin_buf', 'kepala_buf']) }]
    },
    handler: UploadController.uploadImage
  },
  {
    method: 'DELETE',
    path: '/api/upload/{publicId}',
    options: {
      pre: [{ method: checkRole(['admin_buf', 'kepala_buf']) }]
    },
    handler: UploadController.deleteImage
  }
];

module.exports = uploadRoutes;