const { query } = require('../config/database');
const { getAcademicYear, getSemesterFromDate } = require('../utils/academicYear');

class ReportController {
  static async getDamageReports(request, h) {
    try {
      const { search, status, priority } = request.query;
      const user = request.auth.credentials.user;

      let sql = `
        SELECT 
          dr.id,
          dr.asset_id as "assetId",
          a.name as "assetName",
          dr.reported_by as "reportedBy",
          u.name as "reporterName",
          dr.description,
          dr.priority,
          dr.status,
          dr.photo_url as "photoUrl",
          dr.notes,
          dr.academic_year as "academicYear",
          dr.semester,
          dr.created_at as "createdAt",
          dr.updated_at as "updatedAt"
        FROM damage_reports dr
        INNER JOIN assets a ON dr.asset_id = a.id
        INNER JOIN users u ON dr.reported_by = u.id
        WHERE 1=1
      `;
      const params = [];
      let paramCount = 0;

      // Sesuai permintaan: hanya kepala_buf yang bisa melihat semua laporan
      // Admin dan staf hanya bisa melihat detail (tapi kita batasi query berdasarkan role)
      if (!['kepala_buf'].includes(user.role)) {
        // Untuk non-kepala_buf, hanya tampilkan laporan yang mereka laporkan
        paramCount++;
        sql += ` AND dr.reported_by = $${paramCount}`;
        params.push(user.id);
      }

      if (search) {
        paramCount++;
        sql += ` AND (a.name ILIKE $${paramCount} OR u.name ILIKE $${paramCount})`;
        params.push(`%${search}%`);
      }

      if (status && status !== 'all') {
        paramCount++;
        sql += ` AND dr.status = $${paramCount}`;
        params.push(status);
      }

      if (priority && priority !== 'all') {
        paramCount++;
        sql += ` AND dr.priority = $${paramCount}`;
        params.push(priority);
      }

      sql += ' ORDER BY dr.created_at DESC';

      const result = await query(sql, params);

      return h.response({
        status: 'success',
        data: {
          damageReports: result.rows
        }
      });
    } catch (error) {
      console.error('Get damage reports error:', error);
      return h.response({
        status: 'error',
        message: 'Terjadi kesalahan server'
      }).code(500);
    }
  }

  static async getDamageReportById(request, h) {
    try {
      const { id } = request.params;
      const user = request.auth.credentials.user;

      let sql = `
        SELECT 
          dr.id,
          dr.asset_id as "assetId",
          a.name as "assetName",
          dr.reported_by as "reportedBy",
          u.name as "reporterName",
          dr.description,
          dr.priority,
          dr.status,
          dr.photo_url as "photoUrl",
          dr.notes,
          dr.academic_year as "academicYear",
          dr.semester,
          dr.created_at as "createdAt",
          dr.updated_at as "updatedAt"
        FROM damage_reports dr
        INNER JOIN assets a ON dr.asset_id = a.id
        INNER JOIN users u ON dr.reported_by = u.id
        WHERE dr.id = $1
      `;
      const params = [id];

      // Jika bukan admin, pastikan hanya laporan user tersebut
      if (!['staf_buf', 'admin_buf', 'kepala_buf'].includes(user.role)) {
        sql += ` AND dr.reported_by = $2`;
        params.push(user.id);
      }

      const result = await query(sql, params);

      if (result.rows.length === 0) {
        return h.response({
          status: 'error',
          message: 'Laporan kerusakan tidak ditemukan'
        }).code(404);
      }

      return h.response({
        status: 'success',
        data: {
          damageReport: result.rows[0]
        }
      });
    } catch (error) {
      console.error('Get damage report by id error:', error);
      return h.response({
        status: 'error',
        message: 'Terjadi kesalahan server'
      }).code(500);
    }
  }

  static async createDamageReport(request, h) {
    try {
      const {
        assetId,
        description,
        priority,
        photoUrl,
        notes
      } = request.payload;

      const reportedBy = request.auth.credentials.user.id;
      const academicYear = getAcademicYear();
      const semester = getSemesterFromDate();

      const result = await query(
        `INSERT INTO damage_reports (asset_id, reported_by, description, priority, status, photo_url, notes, academic_year, semester)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, asset_id as "assetId", reported_by as "reportedBy", description, priority, status, photo_url as "photoUrl", notes, academic_year as "academicYear", semester, created_at as "createdAt"`,
        [assetId, reportedBy, description, priority, 'menunggu', photoUrl, notes, academicYear, semester]
      );

      return h.response({
        status: 'success',
        data: {
          damageReport: result.rows[0]
        }
      }).code(201);
    } catch (error) {
      console.error('Create damage report error:', error);
      return h.response({
        status: 'error',
        message: 'Terjadi kesalahan server'
      }).code(500);
    }
  }

  static async updateDamageReport(request, h) {
    try {
      const { id } = request.params;
      const {
        status,
        priority,
        notes
      } = request.payload;

      const result = await query(
        `UPDATE damage_reports 
         SET status = $1, priority = $2, notes = $3, updated_at = CURRENT_TIMESTAMP
         WHERE id = $4
         RETURNING id, asset_id as "assetId", reported_by as "reportedBy", description, priority, status, photo_url as "photoUrl", notes, academic_year as "academicYear", semester, created_at as "createdAt"`,
        [status, priority, notes, id]
      );

      if (result.rows.length === 0) {
        return h.response({
          status: 'error',
          message: 'Laporan kerusakan tidak ditemukan'
        }).code(404);
      }

      return h.response({
        status: 'success',
        data: {
          damageReport: result.rows[0]
        }
      });
    } catch (error) {
      console.error('Update damage report error:', error);
      return h.response({
        status: 'error',
        message: 'Terjadi kesalahan server'
      }).code(500);
    }
  }

  static async deleteDamageReport(request, h) {
    try {
      const { id } = request.params;

      const result = await query(
        'DELETE FROM damage_reports WHERE id = $1 RETURNING id',
        [id]
      );

      if (result.rows.length === 0) {
        return h.response({
          status: 'error',
          message: 'Laporan kerusakan tidak ditemukan'
        }).code(404);
      }

      return h.response({
        status: 'success',
        message: 'Laporan kerusakan berhasil dihapus'
      });
    } catch (error) {
      console.error('Delete damage report error:', error);
      return h.response({
        status: 'error',
        message: 'Terjadi kesalahan server'
      }).code(500);
    }
  }
}

module.exports = ReportController;