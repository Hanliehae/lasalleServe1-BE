// controllers/uploadController.js - DENGAN FALLBACK
const cloudinary = require('../config/cloudinary');
const { query } = require('../config/database');
const fs = require('fs').promises;
const path = require('path');

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
      const maxSize = 5 * 1024 * 1024;
      if (file._data.length > maxSize) {
        return h.response({
          status: 'error',
          message: 'Ukuran file terlalu besar. Maksimal 5MB'
        }).code(400);
      }

      // ============================================
      // OPTION 1: CLOUDINARY (Jika dikonfigurasi)
      // ============================================
      if (process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
        console.log('☁️ Uploading to Cloudinary...');
        
        const contentType = file.hapi.headers['content-type'];
        const resourceType = contentType === 'application/pdf' ? 'raw' : 'image';
        
        // Generate unique filename dengan ekstensi
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(7);
        const originalFilename = file.hapi.filename;
        const fileExtension = originalFilename.split('.').pop().toLowerCase();
        
        const uploadOptions = {
          folder: 'lasalleserve',
          resource_type: resourceType
        };

        // Untuk raw upload (PDF), tambahkan public_id dengan ekstensi dan buat public
        if (resourceType === 'raw') {
          uploadOptions.public_id = `doc_${timestamp}_${randomStr}.${fileExtension}`;
          uploadOptions.use_filename = true;
          uploadOptions.access_mode = 'public'; // Buat file bisa diakses publik
          uploadOptions.type = 'upload'; // Pastikan type adalah upload (bukan authenticated)
        }

        if (resourceType === 'image') {
          uploadOptions.transformation = [
            { width: 1200, height: 800, crop: 'limit' },
            { quality: 'auto:good' }
          ];
        }

        // Upload ke Cloudinary
        const uploadPromise = new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            uploadOptions,
            (error, result) => {
              if (error) {
                console.error('❌ Cloudinary upload error:', error);
                reject(error);
              } else {
                console.log('✅ Cloudinary upload success:', result.secure_url);
                resolve(result);
              }
            }
          );

          uploadStream.end(file._data);
        });

        try {
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
        } catch (cloudinaryError) {
          console.warn('⚠️ Cloudinary failed, falling back to local storage...');
          // Lanjut ke fallback
        }
      }

      // ============================================
      // OPTION 2: LOCAL STORAGE FALLBACK (Development)
      // ============================================
      console.log('💾 Saving to local storage (fallback)...');
      
      // Buat folder uploads di dalam backend folder (HARUS sama dengan server.js)
      // __dirname = controllers folder, jadi '..' = lasalleServe1-BE
      const uploadDir = path.join(__dirname, '..', 'uploads');
      await fs.mkdir(uploadDir, { recursive: true });
      
      // Generate nama file unik
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(7);
      const fileExtension = file.hapi.filename.split('.').pop();
      const fileName = `upload_${timestamp}_${randomStr}.${fileExtension}`;
      const filePath = path.join(uploadDir, fileName);
      
      // Simpan file
      await fs.writeFile(filePath, file._data);
      
      // URL untuk akses file
      const baseUrl = `http://localhost:${process.env.PORT || 3001}`;
      const fileUrl = `${baseUrl}/uploads/${fileName}`;
      
      // Buat route static file (akan kita tambahkan di server.js)
      console.log('✅ File saved locally:', fileUrl);
      
      return h.response({
        status: 'success',
        data: {
          url: fileUrl,
          publicId: fileName,
          format: fileExtension,
          bytes: file._data.length,
          resourceType: 'image',
          isLocal: true  // Flag untuk local storage
        }
      }).code(201);
      
    } catch (error) {
      console.error('❌ Upload error:', error);
      return h.response({
        status: 'error',
        message: 'Gagal mengunggah file. ' + error.message
      }).code(500);
    }
  }

  static async deleteFile(request, h) {
    try {
      const { publicId } = request.params;
      const { resourceType = 'image', isLocal } = request.query;
      
      if (isLocal === 'true') {
        // Hapus file lokal
        const uploadDir = path.join(__dirname, '..', '..', 'uploads');
        const filePath = path.join(uploadDir, publicId);
        await fs.unlink(filePath);
        
        return h.response({
          status: 'success',
          message: 'File lokal berhasil dihapus'
        });
      } else {
        // Hapus dari Cloudinary
        const result = await cloudinary.uploader.destroy(publicId, {
          resource_type: resourceType
        });
        
        return h.response({
          status: 'success',
          message: 'File Cloudinary berhasil dihapus',
          data: result
        });
      }
    } catch (error) {
      console.error('Delete file error:', error);
      return h.response({
        status: 'error',
        message: 'Gagal menghapus file'
      }).code(500);
    }
  }
}

module.exports = UploadController;