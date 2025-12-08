const cloudinary = require('../config/cloudinary');
const { query } = require('../config/database');

class UploadController {
  static async uploadImage(request, h) {
    try {
      const { file } = request.payload;
      
      if (!file) {
        return h.response({
          status: 'error',
          message: 'Tidak ada file yang diunggah'
        }).code(400);
      }

      // Validasi tipe file
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'application/pdf'];
      if (!allowedTypes.includes(file.hapi.headers['content-type'])) {
        return h.response({
          status: 'error',
          message: 'Format file tidak didukung. Gunakan JPG, PNG, atau PDF'
        }).code(400);
      }

      // Validasi ukuran file (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file._data.length > maxSize) {
        return h.response({
          status: 'error',
          message: 'Ukuran file terlalu besar. Maksimal 5MB'
        }).code(400);
      }

      const resourceType = contentType === 'application/pdf' ? 'raw' : 'image';

      // Upload ke Cloudinary
      const uploadPromise = new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'lasalleserve',
            resource_type: 'image' && {
            transformation: [
              { width: 1200, height: 800, crop: 'limit' },
              { quality: 'auto:good' }
            ]
          },
        },
          (error, result) => {
            if (error) {
              reject(error);
            } else {
              resolve(result);
            }
          }
        );

        uploadStream.end(file._data);
      });

      const result = await uploadPromise;

      return h.response({
        status: 'success',
        data: {
          url: result.secure_url,
          publicId: result.public_id,
          format: result.format,
          bytes: result.bytes,
          resourceType: resourceType
        }
      }).code(201);
      
    } catch (error) {
      console.error('Upload error:', error);
      return h.response({
        status: 'error',
        message: 'Gagal mengunggah gambar: ' + error.message
      }).code(500);
    }
  }

  static async deleteFile(request, h) {
    try {
      const { publicId } = request.params;
       const { resourceType = 'image' } = request.query;
      
     const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType
      });

      return h.response({
        status: 'success',
        message: 'Gambar berhasil dihapus',
        data: result
      });
    } catch (error) {
      console.error('Delete image error:', error);
      return h.response({
        status: 'error',
        message: 'Gagal menghapus dokumen'
      }).code(500);
    }
  }
}

module.exports = UploadController;