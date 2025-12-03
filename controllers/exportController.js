// controllers/exportController.js
const { query } = require('../config/database');

class ExportController {
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
        const csvData = ExportController.convertToCSV(loans);
        return h.response(csvData)
          .header('Content-Type', 'text/csv')
          .header('Content-Disposition', `attachment; filename=loans_export_${Date.now()}.csv`);
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
        const csvData = ExportController.convertToCSV(result.rows);
        return h.response(csvData)
          .header('Content-Type', 'text/csv')
          .header('Content-Disposition', `attachment; filename=damage_reports_export_${Date.now()}.csv`);
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

  static convertToCSV(data) {
    if (!data || data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvRows = [];
    
    // Header
    csvRows.push(headers.join(','));
    
    // Rows
    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header];
        if (typeof value === 'object') {
          return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
        }
        return `"${String(value || '').replace(/"/g, '""')}"`;
      });
      csvRows.push(values.join(','));
    }
    
    return csvRows.join('\n');
  }
}

module.exports = ExportController;