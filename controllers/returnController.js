// controllers/returnController.js
const { query, getClient } = require('../config/database');

class ReturnController {
  // Proses pengembalian (admin)
  static async processReturn(request, h) {
    let client;
    try {
      const { loanId } = request.params;
      const { returnedItems, notes } = request.payload;
      const user = request.auth.credentials.user;

      // Hanya admin atau staf_buf yang bisa memproses pengembalian
      if (!['staf_buf', 'admin_buf'].includes(user.role)) {
        return h.response({
          status: 'error',
          message: 'Unauthorized access'
        }).code(403);
      }

      client = await getClient();
      await client.query('BEGIN');

      // 1. Update status loan menjadi 'selesai'
      await client.query(
        'UPDATE loans SET status = $1, returned_at = CURRENT_TIMESTAMP, return_notes = $2 WHERE id = $3',
        ['selesai', notes, loanId]
      );

      // 2. Untuk setiap item yang dikembalikan, update stock asset dan catat kondisi
      for (const item of returnedItems) {
        // Update kondisi dan status pengembalian di loan_items
        await client.query(
          'UPDATE loan_items SET returned_condition = $1 WHERE loan_id = $2 AND asset_id = $3',
          [item.condition, loanId, item.id]
        );

        // Update available_stock di assets (tambahkan kembali)
        await client.query(
          'UPDATE assets SET available_stock = available_stock + $1 WHERE id = $2',
          [item.quantity, item.id]
        );

        // Jika kondisi tidak baik, update kondisi asset
        if (item.condition !== 'baik') {
          await client.query(
            'UPDATE assets SET condition = $1 WHERE id = $2',
            [item.condition, item.id]
          );
        }
      }

      await client.query('COMMIT');

      return h.response({
        status: 'success',
        message: 'Pengembalian berhasil diproses'
      });

    } catch (error) {
      if (client) await client.query('ROLLBACK');
      console.error('Process return error:', error);
      return h.response({
        status: 'error',
        message: 'Gagal memproses pengembalian'
      }).code(500);
    } finally {
      if (client) client.release();
    }
  }

  // Mendapatkan daftar peminjaman yang perlu dikembalikan (status disetujui)
  static async getPendingReturns(request, h) {
    try {
      const user = request.auth.credentials.user;

      let sql = `
        SELECT 
          l.id,
          l.borrower_id,
          u.name as borrower_name,
          l.room_id,
          a_room.name as room_name,
          l.start_date,
          l.end_date,
          l.status,
          l.academic_year,
          l.semester
        FROM loans l
        JOIN users u ON l.borrower_id = u.id
        LEFT JOIN assets a_room ON l.room_id = a_room.id
        WHERE l.status = 'disetujui'
      `;

      // Jika bukan admin, hanya tampilkan peminjaman milik user tersebut
      if (!['staf_buf', 'admin_buf', 'kepala_buf'].includes(user.role)) {
        sql += ` AND l.borrower_id = $1`;
        const result = await query(sql, [user.id]);
        return h.response({
          status: 'success',
          data: { loans: result.rows }
        });
      }

      const result = await query(sql);
      return h.response({
        status: 'success',
        data: { loans: result.rows }
      });

    } catch (error) {
      console.error('Get pending returns error:', error);
      return h.response({
        status: 'error',
        message: 'Gagal mengambil data pengembalian tertunda'
      }).code(500);
    }
  }

  // Mendapatkan riwayat pengembalian (status selesai)
  static async getReturnHistory(request, h) {
    try {
      const { academicYear, semester } = request.query;
      const user = request.auth.credentials.user;

      let sql = `
        SELECT 
          l.id,
          l.borrower_id,
          u.name as borrower_name,
          l.room_id,
          a_room.name as room_name,
          l.start_date,
          l.end_date,
          l.returned_at,
          l.academic_year,
          l.semester,
          l.return_notes
        FROM loans l
        JOIN users u ON l.borrower_id = u.id
        LEFT JOIN assets a_room ON l.room_id = a_room.id
        WHERE l.status = 'selesai'
      `;

      const params = [];
      let paramCount = 0;

      // Filter berdasarkan tahun ajaran
      if (academicYear) {
        paramCount++;
        sql += ` AND l.academic_year = $${paramCount}`;
        params.push(academicYear);
      }

      // Filter berdasarkan semester
      if (semester) {
        paramCount++;
        sql += ` AND l.semester = $${paramCount}`;
        params.push(semester);
      }

      // Jika bukan admin, hanya tampilkan riwayat milik user tersebut
      if (!['staf_buf', 'admin_buf', 'kepala_buf'].includes(user.role)) {
        paramCount++;
        sql += ` AND l.borrower_id = $${paramCount}`;
        params.push(user.id);
      }

      sql += ' ORDER BY l.returned_at DESC';

      const result = await query(sql, params);

      // Untuk setiap loan, ambil detail item yang dikembalikan
      const returns = await Promise.all(
        result.rows.map(async (loan) => {
          const itemsResult = await query(
            `SELECT 
              li.asset_id as id,
              a.name,
              li.quantity,
              li.returned_condition as condition
             FROM loan_items li
             JOIN assets a ON li.asset_id = a.id
             WHERE li.loan_id = $1`,
            [loan.id]
          );

          return {
            ...loan,
            returned_items: itemsResult.rows
          };
        })
      );

      return h.response({
        status: 'success',
        data: { returns }
      });

    } catch (error) {
      console.error('Get return history error:', error);
      return h.response({
        status: 'error',
        message: 'Gagal mengambil riwayat pengembalian'
      }).code(500);
    }
  }
}

module.exports = ReturnController;