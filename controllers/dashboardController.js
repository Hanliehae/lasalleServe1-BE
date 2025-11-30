// controllers/dashboardController.js - PERBAIKI DENGAN IMPORT YANG BENAR
const { query } = require('../config/database');
const { getAcademicYear, getSemesterFromDate } = require('../utils/academicYear'); // IMPORT YANG BENAR

class DashboardController {
  static async getStats(request, h) {
    try {
      const user = request.auth.credentials.user;

      let stats = {};

      // Statistik untuk admin dan staf BUF
      if (['staf_buf', 'admin_buf', 'kepala_buf'].includes(user.role)) {
        // Total aset
        const assetsResult = await query('SELECT COUNT(*) as total FROM assets');
        stats.totalAssets = parseInt(assetsResult.rows[0].total);

        // Total peminjaman
        const loansResult = await query('SELECT COUNT(*) as total FROM loans');
        stats.totalLoans = parseInt(loansResult.rows[0].total);

        // Total laporan kerusakan
        const reportsResult = await query('SELECT COUNT(*) as total FROM damage_reports');
        stats.totalReports = parseInt(reportsResult.rows[0].total);

        // Aset dengan stok rendah
        const lowStockResult = await query('SELECT COUNT(*) as total FROM assets WHERE available_stock < 5');
        stats.lowStockAssets = parseInt(lowStockResult.rows[0].total);

        // Peminjaman menunggu
        const pendingLoansResult = await query('SELECT COUNT(*) as total FROM loans WHERE status = $1', ['menunggu']);
        stats.pendingLoans = parseInt(pendingLoansResult.rows[0].total);

        // Peminjaman aktif
        const activeLoansResult = await query('SELECT COUNT(*) as total FROM loans WHERE status = $1', ['disetujui']);
        stats.activeLoans = parseInt(activeLoansResult.rows[0].total);

        // Laporan menunggu
        const pendingReportsResult = await query('SELECT COUNT(*) as total FROM damage_reports WHERE status = $1', ['menunggu']);
        stats.pendingReports = parseInt(pendingReportsResult.rows[0].total);

        // Peminjaman terlambat
        const overdueLoansResult = await query(
          'SELECT COUNT(*) as total FROM loans WHERE end_date < CURRENT_DATE AND status = $1', 
          ['disetujui']
        );
        stats.overdueLoans = parseInt(overdueLoansResult.rows[0].total);

      } else {
        // Statistik untuk user biasa
        const userId = user.id;

        // Peminjaman aktif
        const activeLoansResult = await query(
          'SELECT COUNT(*) as total FROM loans WHERE borrower_id = $1 AND status = $2',
          [userId, 'disetujui']
        );
        stats.activeLoans = parseInt(activeLoansResult.rows[0].total);

        // Peminjaman menunggu
        const pendingLoansResult = await query(
          'SELECT COUNT(*) as total FROM loans WHERE borrower_id = $1 AND status = $2',
          [userId, 'menunggu']
        );
        stats.pendingLoans = parseInt(pendingLoansResult.rows[0].total);

        // Total laporan
        const reportsResult = await query(
          'SELECT COUNT(*) as total FROM damage_reports WHERE reported_by = $1',
          [userId]
        );
        stats.totalReports = parseInt(reportsResult.rows[0].total);
      }

      return h.response({
        status: 'success',
        data: { stats }
      });
    } catch (error) {
      console.error('Get dashboard stats error:', error);
      return h.response({
        status: 'error',
        message: 'Terjadi kesalahan server'
      }).code(500);
    }
  }

  static async getRecentActivity(request, h) {
    try {
      const user = request.auth.credentials.user;

      let sql = `
        SELECT 
          'loan' as type,
          l.id,
          l.status,
          u.name as "userName",
          a.name as "assetName",
          l.created_at as "createdAt"
        FROM loans l
        INNER JOIN users u ON l.borrower_id = u.id
        LEFT JOIN assets a ON l.room_id = a.id
        WHERE 1=1
      `;

      const params = [];

      // Jika bukan admin, hanya tampilkan aktivitas user tersebut
      if (!['staf_buf', 'admin_buf', 'kepala_buf'].includes(user.role)) {
        sql += ` AND l.borrower_id = $1`;
        params.push(user.id);
      }

      sql += `
        UNION ALL
        SELECT 
          'report' as type,
          dr.id,
          dr.status,
          u.name as "userName",
          a.name as "assetName",
          dr.created_at as "createdAt"
        FROM damage_reports dr
        INNER JOIN users u ON dr.reported_by = u.id
        INNER JOIN assets a ON dr.asset_id = a.id
        WHERE 1=1
      `;

      if (!['staf_buf', 'admin_buf', 'kepala_buf'].includes(user.role)) {
        if (params.length > 0) {
          sql += ` AND dr.reported_by = $${params.length + 1}`;
        } else {
          sql += ` AND dr.reported_by = $1`;
        }
        params.push(user.id);
      }

      sql += ' ORDER BY "createdAt" DESC LIMIT 10';

      const result = await query(sql, params);

      return h.response({
        status: 'success',
        data: {
          activities: result.rows
        }
      });
    } catch (error) {
      console.error('Get recent activity error:', error);
      return h.response({
        status: 'error',
        message: 'Terjadi kesalahan server'
      }).code(500);
    }
  }
}

module.exports = DashboardController;