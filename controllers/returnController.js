const { query, getClient } = require('../config/database');

class ReturnController {
  static async processReturn(request, h) {
    const client = await getClient();
    
    try {
      await client.query('BEGIN');

      const { loanId } = request.params;
      const { returnedItems, notes } = request.payload;
      const user = request.auth.credentials.user;

      // Hanya admin atau staf yang bisa memproses pengembalian
      if (!['staf_buf', 'admin_buf'].includes(user.role)) {
        await client.query('ROLLBACK');
        return h.response({
          status: 'error',
          message: 'Tidak memiliki izin untuk memproses pengembalian'
        }).code(403);
      }

      // 1. Get loan details
      const loanResult = await client.query(
        `SELECT l.*, u.name as "borrowerName"
         FROM loans l
         JOIN users u ON l.borrower_id = u.id
         WHERE l.id = $1 AND l.status = 'disetujui'`,
        [loanId]
      );

      if (loanResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return h.response({
          status: 'error',
          message: 'Peminjaman tidak ditemukan atau belum disetujui'
        }).code(404);
      }

      const loan = loanResult.rows[0];

      // 2. Get original loan items
      const loanItemsResult = await client.query(
        `SELECT li.asset_id, li.quantity, a.name
         FROM loan_items li
         JOIN assets a ON li.asset_id = a.id
         WHERE li.loan_id = $1`,
        [loanId]
      );

      const loanItems = loanItemsResult.rows;

      // 3. Validate returned items
      for (const returnedItem of returnedItems) {
        const originalItem = loanItems.find(item => item.asset_id === returnedItem.id);
        
        if (!originalItem) {
          await client.query('ROLLBACK');
          return h.response({
            status: 'error',
            message: `Item dengan ID ${returnedItem.id} tidak ditemukan dalam peminjaman`
          }).code(400);
        }

        if (returnedItem.quantity > originalItem.quantity) {
          await client.query('ROLLBACK');
          return h.response({
            status: 'error',
            message: `Jumlah pengembalian ${originalItem.name} melebihi jumlah yang dipinjam`
          }).code(400);
        }
      }

      // 4. Process each returned item
      for (const returnedItem of returnedItems) {
        // Update loan item with return condition
        await client.query(
          `UPDATE loan_items 
           SET returned_condition = $1, returned_quantity = $2
           WHERE loan_id = $3 AND asset_id = $4`,
          [returnedItem.condition, returnedItem.quantity, loanId, returnedItem.id]
        );

        // Update asset stock based on condition
        if (returnedItem.condition === 'baik') {
          // Tambah ke stock baik
          await client.query(
            `UPDATE asset_conditions 
             SET quantity = quantity + $1
             WHERE asset_id = $2 AND condition = 'baik'`,
            [returnedItem.quantity, returnedItem.id]
          );
        } else if (returnedItem.condition === 'rusak_ringan') {
          // Kurangi dari baik, tambah ke rusak ringan
          await client.query(
            `UPDATE asset_conditions 
             SET quantity = quantity - $1
             WHERE asset_id = $2 AND condition = 'baik'`,
            [returnedItem.quantity, returnedItem.id]
          );
          
          await client.query(
            `INSERT INTO asset_conditions (asset_id, condition, quantity)
             VALUES ($1, 'rusak_ringan', $2)
             ON CONFLICT (asset_id, condition) 
             DO UPDATE SET quantity = asset_conditions.quantity + $2`,
            [returnedItem.id, returnedItem.quantity]
          );
        } else if (returnedItem.condition === 'rusak_berat') {
          // Kurangi dari baik, tambah ke rusak berat
          await client.query(
            `UPDATE asset_conditions 
             SET quantity = quantity - $1
             WHERE asset_id = $2 AND condition = 'baik'`,
            [returnedItem.quantity, returnedItem.id]
          );
          
          await client.query(
            `INSERT INTO asset_conditions (asset_id, condition, quantity)
             VALUES ($1, 'rusak_berat', $2)
             ON CONFLICT (asset_id, condition) 
             DO UPDATE SET quantity = asset_conditions.quantity + $2`,
            [returnedItem.id, returnedItem.quantity]
          );
        } else if (returnedItem.condition === 'hilang') {
          // Hanya kurangi dari baik (tidak ditambahkan ke kondisi lain)
          await client.query(
            `UPDATE asset_conditions 
             SET quantity = quantity - $1
             WHERE asset_id = $2 AND condition = 'baik'`,
            [returnedItem.quantity, returnedItem.id]
          );
        }
      }

      // 5. Update loan status to completed
      const updateResult = await client.query(
        `UPDATE loans 
         SET status = 'selesai', returned_at = CURRENT_TIMESTAMP, 
             return_notes = $1, processed_by = $2
         WHERE id = $3
         RETURNING id, status, returned_at as "returnedAt"`,
        [notes, user.id, loanId]
      );

      await client.query('COMMIT');

      return h.response({
        status: 'success',
        message: 'Pengembalian berhasil diproses',
        data: {
          loan: updateResult.rows[0],
          returnedItems: returnedItems
        }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Process return error:', error);
      return h.response({
        status: 'error',
        message: error.message || 'Gagal memproses pengembalian'
      }).code(500);
    } finally {
      client.release();
    }
  }

  static async getPendingReturns(request, h) {
    try {
      const user = request.auth.credentials.user;

      let sql = `
        SELECT 
          l.id,
          l.borrower_id as "borrowerId",
          u.name as "borrowerName",
          u.email as "borrowerEmail",
          l.room_id as "roomId",
          a_room.name as "roomName",
          l.start_date as "startDate",
          l.end_date as "endDate",
          l.start_time as "startTime",
          l.end_time as "endTime",
          l.status,
          l.academic_year as "academicYear",
          l.semester,
          l.purpose,
          COALESCE(
            json_agg(
              json_build_object(
                'id', li.asset_id,
                'name', a.name,
                'quantity', li.quantity
              )
            ) FILTER (WHERE li.asset_id IS NOT NULL),
            '[]'
          ) as facilities
        FROM loans l
        JOIN users u ON l.borrower_id = u.id
        LEFT JOIN assets a_room ON l.room_id = a_room.id
        LEFT JOIN loan_items li ON l.id = li.loan_id
        LEFT JOIN assets a ON li.asset_id = a.id
        WHERE l.status = 'disetujui'
      `;

      const params = [];

      // Jika bukan admin, hanya tampilkan peminjaman user tersebut
      if (!['staf_buf', 'admin_buf', 'kepala_buf'].includes(user.role)) {
        sql += ` AND l.borrower_id = $1`;
        params.push(user.id);
      }

      sql += ' GROUP BY l.id, u.id, a_room.id ORDER BY l.end_date ASC';

      const result = await query(sql, params);

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

  static async getReturnHistory(request, h) {
    try {
      const { academicYear, semester } = request.query;
      const user = request.auth.credentials.user;

      let sql = `
        SELECT 
          l.id,
          l.borrower_id as "borrowerId",
          u.name as "borrowerName",
          l.room_id as "roomId",
          a_room.name as "roomName",
          l.start_date as "startDate",
          l.end_date as "endDate",
          l.returned_at as "returnedAt",
          l.return_notes as "returnNotes",
          l.academic_year as "academicYear",
          l.semester,
          l.purpose,
          COALESCE(
            json_agg(
              json_build_object(
                'id', li.asset_id,
                'name', a.name,
                'quantity', li.quantity,
                'returnedCondition', li.returned_condition
              )
            ) FILTER (WHERE li.asset_id IS NOT NULL),
            '[]'
          ) as returnedItems
        FROM loans l
        JOIN users u ON l.borrower_id = u.id
        LEFT JOIN assets a_room ON l.room_id = a_room.id
        LEFT JOIN loan_items li ON l.id = li.loan_id
        LEFT JOIN assets a ON li.asset_id = a.id
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
      if (semester && semester !== 'all') {
        paramCount++;
        sql += ` AND l.semester = $${paramCount}`;
        params.push(semester);
      }

      // Jika bukan admin, hanya tampilkan riwayat user tersebut
      if (!['staf_buf', 'admin_buf', 'kepala_buf'].includes(user.role)) {
        paramCount++;
        sql += ` AND l.borrower_id = $${paramCount}`;
        params.push(user.id);
      }

      sql += ' GROUP BY l.id, u.id, a_room.id ORDER BY l.returned_at DESC';

      const result = await query(sql, params);

      return h.response({
        status: 'success',
        data: { returns: result.rows }
      });

    } catch (error) {
      console.error('Get return history error:', error);
      return h.response({
        status: 'error',
        message: 'Gagal mengambil riwayat pengembalian'
      }).code(500);
    }
  }

  static async getReturnDetail(request, h) {
    try {
      const { loanId } = request.params;
      const user = request.auth.credentials.user;

      let sql = `
        SELECT 
          l.id,
          l.borrower_id as "borrowerId",
          u.name as "borrowerName",
          l.room_id as "roomId",
          a_room.name as "roomName",
          l.start_date as "startDate",
          l.end_date as "endDate",
          l.start_time as "startTime",
          l.end_time as "endTime",
          l.returned_at as "returnedAt",
          l.return_notes as "returnNotes",
          l.academic_year as "academicYear",
          l.semester,
          l.purpose,
          COALESCE(
            json_agg(
              json_build_object(
                'id', li.asset_id,
                'name', a.name,
                'quantity', li.quantity,
                'returnedCondition', li.returned_condition,
                'returnedQuantity', li.returned_quantity
              )
            ) FILTER (WHERE li.asset_id IS NOT NULL),
            '[]'
          ) as returnedItems
        FROM loans l
        JOIN users u ON l.borrower_id = u.id
        LEFT JOIN assets a_room ON l.room_id = a_room.id
        LEFT JOIN loan_items li ON l.id = li.loan_id
        LEFT JOIN assets a ON li.asset_id = a.id
        WHERE l.id = $1 AND l.status = 'selesai'
        GROUP BY l.id, u.id, a_room.id
      `;

      const params = [loanId];

      // Jika bukan admin, pastikan hanya peminjaman user tersebut
      if (!['staf_buf', 'admin_buf', 'kepala_buf'].includes(user.role)) {
        sql += ` AND l.borrower_id = $2`;
        params.push(user.id);
      }

      const result = await query(sql, params);

      if (result.rows.length === 0) {
        return h.response({
          status: 'error',
          message: 'Detail pengembalian tidak ditemukan'
        }).code(404);
      }

      return h.response({
        status: 'success',
        data: { returnDetail: result.rows[0] }
      });

    } catch (error) {
      console.error('Get return detail error:', error);
      return h.response({
        status: 'error',
        message: 'Gagal mengambil detail pengembalian'
      }).code(500);
    }
  }
}

module.exports = ReturnController;