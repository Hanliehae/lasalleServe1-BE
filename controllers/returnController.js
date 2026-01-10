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

      // 1. Get loan details - terima status 'disetujui' DAN 'menunggu_pengembalian'
      const loanResult = await client.query(
        `SELECT l.*, u.name as "borrowerName"
         FROM loans l
         JOIN users u ON l.borrower_id = u.id
         WHERE l.id = $1 AND l.status IN ('disetujui', 'menunggu_pengembalian')`,
        [loanId]
      );

      if (loanResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return h.response({
          status: 'error',
          message: 'Peminjaman tidak ditemukan, belum disetujui, atau sudah dikembalikan'
        }).code(404);
      }

      const loan = loanResult.rows[0];

      // 2. Get original loan items (fasilitas saja, bukan ruangan)
      const loanItemsResult = await client.query(
        `SELECT li.asset_id, li.quantity, a.name
         FROM loan_items li
         JOIN assets a ON li.asset_id = a.id
         WHERE li.loan_id = $1`,
        [loanId]
      );

      const loanItems = loanItemsResult.rows;

      // 3. Pisahkan returned items antara room dan facilities
      const roomItems = returnedItems.filter(item => item.type === 'room');
      const facilityItems = returnedItems.filter(item => item.type === 'facility');

      // 4. Validasi ruangan (jika ada)
      for (const roomItem of roomItems) {
        // Ruangan di-track di loans.room_id, bukan loan_items
        // Validasi bahwa room_id di loan sama dengan item yang dikembalikan
        if (loan.room_id && roomItem.id !== loan.room_id) {
          await client.query('ROLLBACK');
          return h.response({
            status: 'error',
            message: `Ruangan dengan ID ${roomItem.id} tidak sesuai dengan peminjaman`
          }).code(400);
        }
      }

      // 5. Validasi fasilitas
      for (const returnedItem of facilityItems) {
        const originalItem = loanItems.find(item => item.asset_id === returnedItem.id);
        
        if (!originalItem) {
          await client.query('ROLLBACK');
          return h.response({
            status: 'error',
            message: `Fasilitas dengan ID ${returnedItem.id} tidak ditemukan dalam peminjaman`
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

      // 6. Process fasilitas yang dikembalikan (ruangan tidak perlu update stok)
      for (const returnedItem of facilityItems) {
        const originalItem = loanItems.find(item => item.asset_id === returnedItem.id);
        
        // Update loan item with return condition
        await client.query(
          `UPDATE loan_items 
           SET returned_condition = $1, returned_quantity = $2
           WHERE loan_id = $3 AND asset_id = $4`,
          [returnedItem.condition, returnedItem.quantity, loanId, returnedItem.id]
        );

        // Update asset_conditions berdasarkan kondisi pengembalian
        if (returnedItem.condition === 'baik') {
          // Tambah ke kondisi baik
          await client.query(
            `INSERT INTO asset_conditions (asset_id, condition, quantity)
             VALUES ($1, 'baik', $2)
             ON CONFLICT (asset_id, condition) 
             DO UPDATE SET quantity = asset_conditions.quantity + $2`,
            [returnedItem.id, returnedItem.quantity]
          );
          
          // Update available_stock di assets
          await client.query(
            `UPDATE assets 
             SET available_stock = available_stock + $1,
                 total_stock = total_stock + $1
             WHERE id = $2`,
            [returnedItem.quantity, returnedItem.id]
          );
          
        } else if (returnedItem.condition === 'rusak_ringan') {
          // Tambah ke kondisi rusak ringan, tidak mengubah available_stock
          await client.query(
            `INSERT INTO asset_conditions (asset_id, condition, quantity)
             VALUES ($1, 'rusak_ringan', $2)
             ON CONFLICT (asset_id, condition) 
             DO UPDATE SET quantity = asset_conditions.quantity + $2`,
            [returnedItem.id, returnedItem.quantity]
          );
          
          // Update total_stock (tapi available_stock tetap)
          await client.query(
            `UPDATE assets 
             SET total_stock = total_stock + $1
             WHERE id = $2`,
            [returnedItem.quantity, returnedItem.id]
          );
          
        } else if (returnedItem.condition === 'rusak_berat') {
          // Tambah ke kondisi rusak berat, tidak mengubah available_stock
          await client.query(
            `INSERT INTO asset_conditions (asset_id, condition, quantity)
             VALUES ($1, 'rusak_berat', $2)
             ON CONFLICT (asset_id, condition) 
             DO UPDATE SET quantity = asset_conditions.quantity + $2`,
            [returnedItem.id, returnedItem.quantity]
          );
          
          // Update total_stock (tapi available_stock tetap)
          await client.query(
            `UPDATE assets 
             SET total_stock = total_stock + $1
             WHERE id = $2`,
            [returnedItem.quantity, returnedItem.id]
          );
          
        } else if (returnedItem.condition === 'hilang') {
          // Item hilang, kurangi total_stock tapi tidak ada penambahan ke kondisi lain
          await client.query(
            `UPDATE assets 
             SET total_stock = total_stock - $1
             WHERE id = $2`,
            [returnedItem.quantity, returnedItem.id]
          );
          
          // Log kerugian
          await client.query(
            `INSERT INTO asset_losses (asset_id, loan_id, quantity, notes)
             VALUES ($1, $2, $3, $4)`,
            [returnedItem.id, loanId, returnedItem.quantity, `Hilang saat peminjaman ${loanId}`]
          );
        }
      }

       // 5. Update loan status to completed dan catat waktu pengembalian (returned_at)
      const updateResult = await client.query(
        `UPDATE loans 
         SET status = 'selesai', 
             returned_at = CURRENT_TIMESTAMP, 
             return_notes = $1, 
             processed_by = $2,
             updated_at = CURRENT_TIMESTAMP
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

// controllers/returnController.js - TAMBAHKAN LOGGING
static async getPendingReturns(request, h) {
  const client = await getClient();
  
  try {
    console.log('🔄 [ReturnController] Starting getPendingReturns...');
    await client.query('BEGIN');

    const user = request.auth.credentials.user;

    // Update status loan yang terlambat
    console.log('🔄 [ReturnController] Updating overdue loans...');
    const updateResult = await client.query(`
      UPDATE loans 
      SET status = 'menunggu_pengembalian', updated_at = CURRENT_TIMESTAMP
      WHERE status = 'disetujui' 
        AND end_date < CURRENT_DATE
        AND returned_at IS NULL
      RETURNING id
    `);
    
    console.log(`🔄 [ReturnController] Updated ${updateResult.rowCount} overdue loans`);

    // Ambil data loan dengan status 'disetujui' dan 'menunggu_pengembalian'
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
        ) as facilities,
        -- Tandai jika sudah melewati tanggal selesai
        CASE 
          WHEN l.end_date < CURRENT_DATE THEN true
          ELSE false
        END as "isOverdue"
      FROM loans l
      JOIN users u ON l.borrower_id = u.id
      LEFT JOIN assets a_room ON l.room_id = a_room.id
      LEFT JOIN loan_items li ON l.id = li.loan_id
      LEFT JOIN assets a ON li.asset_id = a.id
      WHERE l.status IN ('disetujui', 'menunggu_pengembalian')
        AND l.returned_at IS NULL
    `;

    const params = [];

    // 🔒 AUTHORIZATION: Jika bukan admin/staf, hanya tampilkan pending returns user tersebut
    if (!['staf_buf', 'admin_buf', 'kepala_buf'].includes(user.role)) {
      sql += ` AND l.borrower_id = $1`;
      params.push(user.id);
      console.log(`🔒 [ReturnController] Filtering for user: ${user.id} (${user.role})`);
    } else {
      console.log(`👤 [ReturnController] Admin/Staff - showing all pending returns`);
    }

    sql += ` GROUP BY l.id, u.id, a_room.id ORDER BY l.end_date ASC`;

    console.log('🔄 [ReturnController] Fetching pending loans...');
    const result = await client.query(sql, params);
    console.log(`✅ [ReturnController] Found ${result.rows.length} pending loans`);

    await client.query('COMMIT');

    return h.response({
      status: 'success',
      data: { 
        loans: result.rows,
        stats: {
          total: result.rows.length,
          overdue: result.rows.filter(loan => loan.isOverdue).length,
          today: result.rows.filter(loan => {
            const today = new Date().toISOString().split('T')[0];
            return loan.endDate === today;
          }).length
        }
      }
    });

  } catch (error) {
    console.error('❌ [ReturnController] Error in getPendingReturns:', error);
    console.error('❌ Error details:', error.stack);
    
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('❌ Rollback error:', rollbackError);
    }
    
    return h.response({
      status: 'error',
      message: 'Gagal mengambil data pengembalian tertunda: ' + error.message
    }).code(500);
  } finally {
    try {
      client.release();
    } catch (releaseError) {
      console.error('❌ Client release error:', releaseError);
    }
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