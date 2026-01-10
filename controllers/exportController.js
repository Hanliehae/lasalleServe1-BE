// controllers/exportController.js
const { query } = require('../config/database');

class ExportController {
  // ==================== HELPER FUNCTIONS ====================
  
  /**
   * Format date to Indonesian format (dd/mm/yyyy)
   */
  static formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  /**
   * Format datetime to Indonesian format (dd/mm/yyyy HH:mm)
   */
  static formatDateTime(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }

  /**
   * Format facilities array to readable string
   */
  static formatFacilities(facilitiesArray) {
    if (!facilitiesArray || facilitiesArray.length === 0) return '-';
    return facilitiesArray
      .map(f => `${f.name} (${f.quantity}x)`)
      .join(', ');
  }

  /**
   * Translate loan status to Indonesian
   */
  static translateLoanStatus(status) {
    const statusMap = {
      'menunggu': 'Menunggu',
      'disetujui': 'Disetujui',
      'ditolak': 'Ditolak',
      'selesai': 'Selesai',
      'menunggu_pengembalian': 'Menunggu Pengembalian',
      'dibatalkan': 'Dibatalkan'
    };
    return statusMap[status] || status;
  }

  /**
   * Translate priority to Indonesian
   */
  static translatePriority(priority) {
    const priorityMap = {
      'tinggi': 'Tinggi',
      'sedang': 'Sedang',
      'rendah': 'Rendah'
    };
    return priorityMap[priority] || priority;
  }

  /**
   * Translate damage report status to Indonesian
   */
  static translateDamageStatus(status) {
    const statusMap = {
      'menunggu': 'Menunggu',
      'dalam_perbaikan': 'Dalam Perbaikan',
      'selesai': 'Selesai'
    };
    return statusMap[status] || status;
  }

  /**
   * Translate semester to Indonesian
   */
  static translateSemester(semester) {
    const semesterMap = {
      'ganjil': 'Ganjil',
      'genap': 'Genap'
    };
    return semesterMap[semester] || semester;
  }

  /**
   * Escape CSV value
   */
  static escapeCSV(value) {
    if (value === null || value === undefined) return '';
    const stringValue = String(value);
    // If contains comma, quotes, or newline, wrap in quotes and escape quotes
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  }

  // ==================== CSV CONVERSION FUNCTIONS ====================

  /**
   * Convert loans data to formatted CSV for export
   */
  static convertLoansToCSV(loans) {
    if (!loans || loans.length === 0) {
      return 'Tidak ada data untuk diekspor';
    }

    const headers = [
      'Nama Peminjam',
      'Email',
      'Ruangan',
      'Fasilitas',
      'Tanggal Mulai',
      'Waktu Mulai',
      'Tanggal Selesai',
      'Waktu Selesai',
      'Status',
      'Keperluan',
      'Tahun Ajaran',
      'Semester',
      'Tanggal Dikembalikan',
      'Catatan Pengembalian'
    ];

    const rows = loans.map(loan => {
      return [
        this.escapeCSV(loan.borrower_name || ''),
        this.escapeCSV(loan.borrower_email || ''),
        this.escapeCSV(loan.room_name || '-'),
        this.escapeCSV(this.formatFacilities(loan.facilities)),
        this.escapeCSV(this.formatDate(loan.start_date)),
        this.escapeCSV(loan.start_time || '-'),
        this.escapeCSV(this.formatDate(loan.end_date)),
        this.escapeCSV(loan.end_time || '-'),
        this.escapeCSV(this.translateLoanStatus(loan.status)),
        this.escapeCSV(loan.purpose || '-'),
        this.escapeCSV(loan.academic_year || '-'),
        this.escapeCSV(this.translateSemester(loan.semester)),
        this.escapeCSV(this.formatDateTime(loan.returned_at)),
        this.escapeCSV(loan.return_notes || '-')
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Convert damage reports data to formatted CSV for export
   */
  static convertDamageReportsToCSV(reports) {
    if (!reports || reports.length === 0) {
      return 'Tidak ada data untuk diekspor';
    }

    const headers = [
      'Nama Aset',
      'Kategori',
      'Pelapor',
      'Email Pelapor',
      'Deskripsi Kerusakan',
      'Prioritas',
      'Status',
      'Catatan',
      'Tahun Ajaran',
      'Semester',
      'Tanggal Laporan',
      'Terakhir Diperbarui'
    ];

    const rows = reports.map(report => {
      return [
        this.escapeCSV(report.asset_name || ''),
        this.escapeCSV(report.asset_category || '-'),
        this.escapeCSV(report.reporter_name || ''),
        this.escapeCSV(report.reporter_email || ''),
        this.escapeCSV(report.description || '-'),
        this.escapeCSV(this.translatePriority(report.priority)),
        this.escapeCSV(this.translateDamageStatus(report.status)),
        this.escapeCSV(report.notes || '-'),
        this.escapeCSV(report.academic_year || '-'),
        this.escapeCSV(this.translateSemester(report.semester)),
        this.escapeCSV(this.formatDateTime(report.created_at)),
        this.escapeCSV(this.formatDateTime(report.updated_at))
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  // ==================== EXPORT ENDPOINTS ====================

  static async exportLoans(request, h) {
    try {
      const { academicYear, semester, format = 'json' } = request.query;
      const user = request.auth.credentials.user;

      // Hanya admin dan kepala_buf yang bisa export
      if (!['admin_buf', 'kepala_buf'].includes(user.role)) {
        return h.response({
          status: 'error',
          message: 'Unauthorized access'
        }).code(403);
      }

      let sql = `
        SELECT 
          l.id,
          u.name as borrower_name,
          u.email as borrower_email,
          a_room.name as room_name,
          l.start_date,
          l.end_date,
          l.start_time,
          l.end_time,
          l.status,
          l.purpose,
          l.academic_year,
          l.semester,
          l.created_at,
          l.returned_at,
          l.return_notes
        FROM loans l
        JOIN users u ON l.borrower_id = u.id
        LEFT JOIN assets a_room ON l.room_id = a_room.id
        WHERE 1=1
      `;

      const params = [];
      let paramCount = 0;

      if (academicYear) {
        paramCount++;
        sql += ` AND l.academic_year = $${paramCount}`;
        params.push(academicYear);
      }

      if (semester && semester !== 'all') {
        paramCount++;
        sql += ` AND l.semester = $${paramCount}`;
        params.push(semester);
      }

      sql += ' ORDER BY l.created_at DESC';

      const result = await query(sql, params);

      // Ambil fasilitas untuk setiap loan
      const loans = await Promise.all(
        result.rows.map(async (loan) => {
          const itemsResult = await query(
            `SELECT 
              a.name,
              li.quantity
             FROM loan_items li
             JOIN assets a ON li.asset_id = a.id
             WHERE li.loan_id = $1`,
            [loan.id]
          );

          return {
            ...loan,
            facilities: itemsResult.rows
          };
        })
      );

      // Jika format CSV
      if (format === 'csv') {
        const csvData = ExportController.convertLoansToCSV(loans);
        return h.response(csvData)
          .header('Content-Type', 'text/csv; charset=utf-8')
          .header('Content-Disposition', `attachment; filename=laporan_peminjaman_${Date.now()}.csv`);
      }

      // Default JSON
      return h.response({
        status: 'success',
        data: { loans }
      });

    } catch (error) {
      console.error('Export loans error:', error);
      return h.response({
        status: 'error',
        message: 'Gagal mengekspor data'
      }).code(500);
    }
  }

  static async exportDamageReports(request, h) {
    try {
      const { academicYear, semester, format = 'json' } = request.query;
      const user = request.auth.credentials.user;

      if (!['admin_buf', 'kepala_buf'].includes(user.role)) {
        return h.response({
          status: 'error',
          message: 'Unauthorized access'
        }).code(403);
      }

      let sql = `
        SELECT 
          dr.id,
          a.name as asset_name,
          a.category as asset_category,
          u.name as reporter_name,
          u.email as reporter_email,
          dr.description,
          dr.priority,
          dr.status,
          dr.notes,
          dr.academic_year,
          dr.semester,
          dr.created_at,
          dr.updated_at
        FROM damage_reports dr
        JOIN assets a ON dr.asset_id = a.id
        JOIN users u ON dr.reported_by = u.id
        WHERE 1=1
      `;

      const params = [];
      let paramCount = 0;

      if (academicYear) {
        paramCount++;
        sql += ` AND dr.academic_year = $${paramCount}`;
        params.push(academicYear);
      }

      if (semester && semester !== 'all') {
        paramCount++;
        sql += ` AND dr.semester = $${paramCount}`;
        params.push(semester);
      }

      sql += ' ORDER BY dr.created_at DESC';

      const result = await query(sql, params);

      if (format === 'csv') {
        const csvData = ExportController.convertDamageReportsToCSV(result.rows);
        return h.response(csvData)
          .header('Content-Type', 'text/csv; charset=utf-8')
          .header('Content-Disposition', `attachment; filename=laporan_kerusakan_${Date.now()}.csv`);
      }

      return h.response({
        status: 'success',
        data: { reports: result.rows }
      });

    } catch (error) {
      console.error('Export damage reports error:', error);
      return h.response({
        status: 'error',
        message: 'Gagal mengekspor data'
      }).code(500);
    }
  }
}

module.exports = ExportController;