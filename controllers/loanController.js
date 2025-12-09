const { query, getClient } = require('../config/database');
const { getAcademicYear, getSemesterFromDate } = require('../utils/academicYear');

class LoanController {
  static async getLoans(request, h) {
    try {
      const { search, status, academicYear, semester } = request.query;
      const user = request.auth.credentials.user;

      let sql = `
        SELECT 
          l.id,
          l.borrower_id as "borrowerId",
          u.name as "borrowerName",
          u.email as "borrowerEmail",
          l.room_id as "roomId",
          a_room.name as "roomName",
          l.purpose,
          l.start_date as "startDate",
          l.end_date as "endDate",
          l.start_time as "startTime",
          l.end_time as "endTime",
          l.status,
          l.academic_year as "academicYear",
          l.semester,
          l.returned_at as "returnedAt",
          l.return_notes as "returnNotes",
          l.created_at as "createdAt",
          l.updated_at as "updatedAt",
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
        INNER JOIN users u ON l.borrower_id = u.id
        LEFT JOIN assets a_room ON l.room_id = a_room.id
        LEFT JOIN loan_items li ON l.id = li.loan_id
        LEFT JOIN assets a ON li.asset_id = a.id
        WHERE 1=1
      `;
      
      const params = [];
      let paramCount = 0;

      // Filter berdasarkan role
      if (!['staf_buf', 'admin_buf', 'kepala_buf'].includes(user.role)) {
        paramCount++;
        sql += ` AND l.borrower_id = $${paramCount}`;
        params.push(user.id);
      }

      if (search) {
        paramCount++;
        sql += ` AND (u.name ILIKE $${paramCount} OR a_room.name ILIKE $${paramCount})`;
        params.push(`%${search}%`);
      }

      if (status && status !== 'all') {
        paramCount++;
        sql += ` AND l.status = $${paramCount}`;
        params.push(status);
      }

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

      sql += ' GROUP BY l.id, u.id, a_room.id ORDER BY l.created_at ASC';

      const result = await query(sql, params);

      return h.response({
        status: 'success',
        data: { loans: result.rows }
      });
    } catch (error) {
      console.error('Get loans error:', error);
      return h.response({
        status: 'error',
        message: 'Terjadi kesalahan server'
      }).code(500);
    }
  }

  static async createLoan(request, h) {
    const client = await getClient();
    
    try {
      await client.query('BEGIN');

      const {
        roomId,
        facilities = [],
        startDate,
        endDate,
        startTime = '08:00',
        endTime = '17:00',
        purpose,
        academicYear,
        semester,
        attachmentUrl = null
      } = request.payload;

      const borrowerId = request.auth.credentials.user.id;

      // Validasi: minimal ada ruangan ATAU fasilitas
      if (!roomId && facilities.length === 0) {
        throw new Error('Harus memilih ruangan atau minimal satu fasilitas');
      }

      // Validasi tanggal
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (end < start) {
        throw new Error('Tanggal selesai tidak boleh sebelum tanggal mulai');
      }

      if (roomId && endTime > '17:00' && !attachmentUrl){
        throw new Error('Peminjaman ruangan melebihi jam operasional (17:00) wajib melampirkan surat izin.');
      }

      // ============================================
      // VALIDASI DOUBLE BOOKING - Cek overlap peminjaman
      // ============================================
      
      // Cek overlap untuk ruangan
      if (roomId) {
        const roomOverlapQuery = `
          SELECT l.id, u.name as borrower_name, l.start_date, l.end_date, l.start_time, l.end_time
          FROM loans l
          INNER JOIN users u ON l.borrower_id = u.id
          WHERE l.room_id = $1
            AND l.status NOT IN ('ditolak', 'selesai')
            AND (
              -- Cek overlap tanggal
              (l.start_date <= $3 AND l.end_date >= $2)
            )
            AND (
              -- Cek overlap waktu (jika tanggal overlap)
              (l.start_time < $5 AND l.end_time > $4)
              OR (l.start_time >= $4 AND l.start_time < $5)
              OR (l.end_time > $4 AND l.end_time <= $5)
            )
        `;
        
        const roomOverlap = await client.query(roomOverlapQuery, [
          roomId, startDate, endDate, startTime, endTime
        ]);

        if (roomOverlap.rows.length > 0) {
          const conflict = roomOverlap.rows[0];
          const conflictStartDate = new Date(conflict.start_date).toLocaleDateString('id-ID');
          const conflictEndDate = new Date(conflict.end_date).toLocaleDateString('id-ID');
          throw new Error(
            `Ruangan sudah dipinjam oleh ${conflict.borrower_name} pada ${conflictStartDate} - ${conflictEndDate} ` +
            `pukul ${conflict.start_time} - ${conflict.end_time}. Silakan pilih waktu lain.`
          );
        }
      }

      // Cek overlap untuk fasilitas
      for (const facility of facilities) {
        const facilityOverlapQuery = `
          SELECT 
            l.id, 
            u.name as borrower_name, 
            l.start_date, 
            l.end_date, 
            l.start_time, 
            l.end_time,
            a.name as asset_name,
            li.quantity as borrowed_quantity,
            a.available_stock
          FROM loans l
          INNER JOIN users u ON l.borrower_id = u.id
          INNER JOIN loan_items li ON l.id = li.loan_id
          INNER JOIN assets a ON li.asset_id = a.id
          WHERE li.asset_id = $1
            AND l.status NOT IN ('ditolak', 'selesai')
            AND (
              -- Cek overlap tanggal
              (l.start_date <= $3 AND l.end_date >= $2)
            )
            AND (
              -- Cek overlap waktu
              (l.start_time < $5 AND l.end_time > $4)
              OR (l.start_time >= $4 AND l.start_time < $5)
              OR (l.end_time > $4 AND l.end_time <= $5)
            )
        `;

        const facilityOverlap = await client.query(facilityOverlapQuery, [
          facility.id, startDate, endDate, startTime, endTime
        ]);

        if (facilityOverlap.rows.length > 0) {
          // Hitung total yang sudah dipinjam di waktu yang overlap
          const totalBorrowed = facilityOverlap.rows.reduce((sum, row) => sum + row.borrowed_quantity, 0);
          const assetInfo = facilityOverlap.rows[0];
          const availableForThisTime = assetInfo.available_stock - totalBorrowed;

          if (facility.quantity > availableForThisTime) {
            const conflict = facilityOverlap.rows[0];
            const conflictStartDate = new Date(conflict.start_date).toLocaleDateString('id-ID');
            const conflictEndDate = new Date(conflict.end_date).toLocaleDateString('id-ID');
            throw new Error(
              `${assetInfo.asset_name} tidak tersedia cukup untuk waktu tersebut. ` +
              `Sudah dipinjam ${totalBorrowed} unit oleh peminjam lain pada ${conflictStartDate} - ${conflictEndDate} ` +
              `pukul ${conflict.start_time} - ${conflict.end_time}. ` +
              `Tersedia: ${availableForThisTime} unit, Diminta: ${facility.quantity} unit.`
            );
          }
        }
      }
      // ============================================
      // END VALIDASI DOUBLE BOOKING
      // ============================================
    
      // Gunakan academicYear dari payload atau generate otomatis
      const finalAcademicYear = academicYear || getAcademicYear(start);
      const finalSemester = semester || getSemesterFromDate(start);

      // 1. Insert loan
      const loanResult = await client.query(
        `INSERT INTO loans (borrower_id, room_id, purpose, start_date, end_date, 
                          start_time, end_time, status, academic_year, semester, attachment_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id`,
        [borrowerId, roomId || null, purpose, startDate, endDate, 
         startTime, endTime, 'menunggu', finalAcademicYear, finalSemester, attachmentUrl]
      );

      const loanId = loanResult.rows[0].id;

      // 2. Process facilities jika ada
      for (const facility of facilities) {
        // Check stock availability
        const stockResult = await client.query(
          `SELECT a.name, a.available_stock as "availableStock"
           FROM assets a
           WHERE a.id = $1 AND a.category = 'fasilitas'`,
          [facility.id]
        );

        if (stockResult.rows.length === 0) {
          throw new Error(`Fasilitas dengan ID ${facility.id} tidak ditemukan`);
        }

        const availableStock = stockResult.rows[0].availableStock;
        if (availableStock < facility.quantity) {
          throw new Error(`Stok ${stockResult.rows[0].name} tidak mencukupi. Tersedia: ${availableStock}, Diminta: ${facility.quantity}`);
        }

        // Insert loan item
        await client.query(
          'INSERT INTO loan_items (loan_id, asset_id, quantity) VALUES ($1, $2, $3)',
          [loanId, facility.id, facility.quantity]
        );

        // Update stock (akan dikurangi saat disetujui, bukan sekarang)
        // Stok akan dikurangi di updateLoanStatus ketika status berubah menjadi 'disetujui'
      }

      // 3. Get complete loan data
      const completeLoan = await client.query(
        `SELECT l.*, 
          json_agg(DISTINCT jsonb_build_object(
            'id', li.asset_id,
            'name', a.name,
            'quantity', li.quantity
          )) as facilities
         FROM loans l
         LEFT JOIN loan_items li ON l.id = li.loan_id
         LEFT JOIN assets a ON li.asset_id = a.id
         WHERE l.id = $1
         GROUP BY l.id`,
        [loanId]
      );

      await client.query('COMMIT');

      return h.response({
        status: 'success',
        message: 'Peminjaman berhasil diajukan',
        data: {
          loan: completeLoan.rows[0]
        }
      }).code(201);

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Create loan error:', error);
      return h.response({
        status: 'error',
        message: error.message
      }).code(400);
    } finally {
      client.release();
    }
  }

 // controllers/loanController.js - PERBAIKI bagian updateLoanStatus
static async updateLoanStatus(request, h) {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');

    const { id } = request.params;
    const { status, notes = '' } = request.payload;
    const user = request.auth.credentials.user;

    // Get current loan status
    const currentLoan = await client.query(
      'SELECT status, borrower_id FROM loans WHERE id = $1',
      [id]
    );

    if (currentLoan.rows.length === 0) {
      await client.query('ROLLBACK');
      return h.response({
        status: 'error',
        message: 'Peminjaman tidak ditemukan'
      }).code(404);
    }

    const currentStatus = currentLoan.rows[0].status;

    // Hanya admin/staff yang bisa approve/reject
    if (!['staf_buf', 'admin_buf'].includes(user.role)) {
      await client.query('ROLLBACK');
      return h.response({
        status: 'error',
        message: 'Tidak memiliki izin untuk mengubah status'
      }).code(403);
    }

    // Validasi transisi status
    const allowedTransitions = {
      'menunggu': ['disetujui', 'ditolak'],
      'disetujui': ['menunggu_pengembalian', 'ditolak'],
      'menunggu_pengembalian': ['selesai'],
      'ditolak': ['menunggu'],
      'selesai': []
    };

    if (!allowedTransitions[currentStatus]?.includes(status)) {
      await client.query('ROLLBACK');
      return h.response({
        status: 'error',
        message: `Tidak dapat mengubah status dari ${currentStatus} ke ${status}`
      }).code(400);
    }

    // Jika status berubah menjadi 'disetujui' dari 'menunggu', kurangi stock
    if (status === 'disetujui' && currentStatus === 'menunggu') {
      // Get all loan items
      const loanItems = await client.query(
        'SELECT asset_id, quantity FROM loan_items WHERE loan_id = $1',
        [id]
      );

      // Update stock untuk setiap item
      for (const item of loanItems.rows) {
        // Update asset_conditions untuk kondisi 'baik'
        await client.query(
          `UPDATE asset_conditions 
           SET quantity = quantity - $1
           WHERE asset_id = $2 AND condition = 'baik'`,
          [item.quantity, item.asset_id]
        );

        // Update available_stock di assets
        await client.query(
          `UPDATE assets 
           SET available_stock = available_stock - $1
           WHERE id = $2`,
          [item.quantity, item.asset_id]
        );
      }
    }

    // Jika status berubah menjadi 'ditolak' dari 'disetujui', kembalikan stock
    if (status === 'ditolak' && currentStatus === 'disetujui') {
      const loanItems = await client.query(
        'SELECT asset_id, quantity FROM loan_items WHERE loan_id = $1',
        [id]
      );

      for (const item of loanItems.rows) {
        // Kembalikan ke asset_conditions kondisi 'baik'
        await client.query(
          `UPDATE asset_conditions 
           SET quantity = quantity + $1
           WHERE asset_id = $2 AND condition = 'baik'`,
          [item.quantity, item.asset_id]
        );

        // Kembalikan available_stock di assets
        await client.query(
          `UPDATE assets 
           SET available_stock = available_stock + $1
           WHERE id = $2`,
          [item.quantity, item.asset_id]
        );
      }
    }

    // Update loan status dengan notes - PERBAIKI QUERY INI
    const result = await client.query(
      `UPDATE loans 
       SET status = $1, 
           updated_at = CURRENT_TIMESTAMP,
           approved_by = $2,
           approval_notes = $3
       WHERE id = $4
       RETURNING id, status, updated_at`,
      [status, user.id, notes || null, id]  // notes bisa null jika kosong
    );

    await client.query('COMMIT');

    return h.response({
      status: 'success',
      message: `Status peminjaman berhasil diubah menjadi ${status}`,
      data: {
        loan: result.rows[0]
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update loan status error:', error);
    return h.response({
      status: 'error',
      message: error.message || 'Terjadi kesalahan server'
    }).code(500);
  } finally {
    client.release();
  }
}

  static async getLoanById(request, h) {
    try {
      const { id } = request.params;
      const user = request.auth.credentials.user;

      let sql = `
        SELECT 
          l.id,
          l.borrower_id as "borrowerId",
          u.name as "borrowerName",
          l.room_id as "roomId",
          a_room.name as "roomName",
          l.purpose,
          l.start_date as "startDate",
          l.end_date as "endDate",
          l.start_time as "startTime",
          l.end_time as "endTime",
          l.status,
          l.academic_year as "academicYear",
          l.semester,
          l.returned_at as "returnedAt",
          l.return_notes as "returnNotes",
          l.created_at as "createdAt",
          l.updated_at as "updatedAt",
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
        INNER JOIN users u ON l.borrower_id = u.id
        LEFT JOIN assets a_room ON l.room_id = a_room.id
        LEFT JOIN loan_items li ON l.id = li.loan_id
        LEFT JOIN assets a ON li.asset_id = a.id
        WHERE l.id = $1
      `;

      const params = [id];

      // Jika bukan admin, pastikan hanya peminjaman user tersebut
      if (!['staf_buf', 'admin_buf', 'kepala_buf'].includes(user.role)) {
        sql += ` AND l.borrower_id = $2`;
        params.push(user.id);
      }

      sql += ' GROUP BY l.id, u.id, a_room.id';

      const result = await query(sql, params);

      if (result.rows.length === 0) {
        return h.response({
          status: 'error',
          message: 'Peminjaman tidak ditemukan'
        }).code(404);
      }

      return h.response({
        status: 'success',
        data: {
          loan: result.rows[0]
        }
      });

    } catch (error) {
      console.error('Get loan by id error:', error);
      return h.response({
        status: 'error',
        message: 'Terjadi kesalahan server'
      }).code(500);
    }
  }

  static async deleteLoan(request, h) {
    const client = await getClient();
    
    try {
      await client.query('BEGIN');

      const { id } = request.params;
      const user = request.auth.credentials.user;

      // Get loan data
      const loanResult = await client.query(
        'SELECT borrower_id, status FROM loans WHERE id = $1',
        [id]
      );

      if (loanResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return h.response({
          status: 'error',
          message: 'Peminjaman tidak ditemukan'
        }).code(404);
      }

      const loan = loanResult.rows[0];

      // Hanya admin atau pemilik yang bisa menghapus (jika status masih menunggu)
      const canDelete = ['staf_buf', 'admin_buf'].includes(user.role) || 
                       (loan.borrower_id === user.id && loan.status === 'menunggu');

      if (!canDelete) {
        await client.query('ROLLBACK');
        return h.response({
          status: 'error',
          message: 'Tidak memiliki izin untuk menghapus peminjaman ini'
        }).code(403);
      }

      // Jika status disetujui, kembalikan stock terlebih dahulu
      if (loan.status === 'disetujui') {
        const loanItems = await client.query(
          'SELECT asset_id, quantity FROM loan_items WHERE loan_id = $1',
          [id]
        );

        for (const item of loanItems.rows) {
          await client.query(
            `UPDATE asset_conditions 
             SET quantity = quantity + $1
             WHERE asset_id = $2 AND condition = 'baik'`,
            [item.quantity, item.asset_id]
          );
        }
      }

      // Delete loan items first (cascade)
      await client.query('DELETE FROM loan_items WHERE loan_id = $1', [id]);

      // Delete loan
      const deleteResult = await client.query(
        'DELETE FROM loans WHERE id = $1 RETURNING id',
        [id]
      );

      await client.query('COMMIT');

      return h.response({
        status: 'success',
        message: 'Peminjaman berhasil dihapus'
      });

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Delete loan error:', error);
      return h.response({
        status: 'error',
        message: 'Terjadi kesalahan server'
      }).code(500);
    } finally {
      client.release();
    }
  }
}

module.exports = LoanController;