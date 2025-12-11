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
        // Validasi sederhana
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'application/pdf'];
      const contentType = file.hapi.headers['content-type'];
      
      if (!allowedTypes.includes(contentType)) {
        return h.response({
          status: 'error',
          message: 'Format file tidak didukung. Gunakan JPG, PNG, atau PDF (maks 5MB)'
        }).code(400);
      }

     if (!process.env.CLOUDINARY_API_KEY) {
        console.warn('⚠️ Cloudinary tidak dikonfigurasi, menggunakan local storage simulasi');
        
        // Simulasi URL lokal (untuk development)
        const mockUrl = `https://via.placeholder.com/600x400/cccccc/969696?text=Upload+Simulation`;
        
        return h.response({
          status: 'success',
          data: {
            url: mockUrl,
            publicId: `mock_${Date.now()}`,
            format: contentType.split('/')[1],
            bytes: file._data.length,
            resourceType: 'image'
          }
        }).code(201);
      }
      // Upload ke Cloudinary
      const uploadPromise = new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          uploadOptions,
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
        message: 'Gagal mengunggah file: ' + (error.message || 'Ukuran file terlalu besar')
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