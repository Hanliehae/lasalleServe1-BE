const { query } = require('../config/database');
const { getAcademicYear, getSemesterFromDate } = require('../utils/academicYear');

class LoanController {
  static async getLoans(request, h) {
    try {
      const { search, status } = request.query;
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
          l.created_at as "createdAt",
          l.updated_at as "updatedAt"
        FROM loans l
        INNER JOIN users u ON l.borrower_id = u.id
        LEFT JOIN assets a_room ON l.room_id = a_room.id
        WHERE 1=1
      `;
      const params = [];
      let paramCount = 0;

      // Jika bukan admin, hanya tampilkan peminjaman user tersebut
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

      sql += ' ORDER BY l.created_at DESC';

      const result = await query(sql, params);

      // Untuk setiap loan, ambil facilities (loan_items)
      const loans = await Promise.all(
        result.rows.map(async (loan) => {
          const facilitiesResult = await query(
            `SELECT 
              li.asset_id as "id",
              a.name,
              li.quantity
             FROM loan_items li
             INNER JOIN assets a ON li.asset_id = a.id
             WHERE li.loan_id = $1`,
            [loan.id]
          );

          return {
            ...loan,
            facilities: facilitiesResult.rows
          };
        })
      );

      return h.response({
        status: 'success',
        data: { loans }
      });
    } catch (error) {
      console.error('Get loans error:', error);
      return h.response({
        status: 'error',
        message: 'Terjadi kesalahan server'
      }).code(500);
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
          l.created_at as "createdAt",
          l.updated_at as "updatedAt"
        FROM loans l
        INNER JOIN users u ON l.borrower_id = u.id
        LEFT JOIN assets a_room ON l.room_id = a_room.id
        WHERE l.id = $1
      `;
      const params = [id];

      // Jika bukan admin, pastikan hanya peminjaman user tersebut
      if (!['staf_buf', 'admin_buf', 'kepala_buf'].includes(user.role)) {
        sql += ` AND l.borrower_id = $2`;
        params.push(user.id);
      }

      const result = await query(sql, params);

      if (result.rows.length === 0) {
        return h.response({
          status: 'error',
          message: 'Peminjaman tidak ditemukan'
        }).code(404);
      }

      const loan = result.rows[0];

      // Ambil facilities
      const facilitiesResult = await query(
        `SELECT 
          li.asset_id as "id",
          a.name,
          li.quantity
         FROM loan_items li
         INNER JOIN assets a ON li.asset_id = a.id
         WHERE li.loan_id = $1`,
        [loan.id]
      );

      loan.facilities = facilitiesResult.rows;

      return h.response({
        status: 'success',
        data: { loan }
      });
    } catch (error) {
      console.error('Get loan by id error:', error);
      return h.response({
        status: 'error',
        message: 'Terjadi kesalahan server'
      }).code(500);
    }
  }


static async createLoan(request, h) {
  const { query } = require('../config/database'); // TAMBAHKAN ini
  const client = await query.getClient(); // ATAU sesuaikan dengan connection pool Anda
  
  try {
    await client.query('BEGIN');

    const {
      roomId,
      facilities,
      startDate,
      endDate,
      startTime,
      endTime,
      purpose,
      academicYear,
      semester
    } = request.payload;

    const borrowerId = request.auth.credentials.user.id;

    // Insert loan
    const loanResult = await client.query(
      `INSERT INTO loans (borrower_id, room_id, purpose, start_date, end_date, start_time, end_time, status, academic_year, semester)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [borrowerId, roomId, purpose, startDate, endDate, startTime, endTime, 'menunggu', academicYear, semester]
    );

    const loanId = loanResult.rows[0].id;

    // Insert loan items (facilities)
    if (facilities && facilities.length > 0) {
      for (const facility of facilities) {
        await client.query(
          'INSERT INTO loan_items (loan_id, asset_id, quantity) VALUES ($1, $2, $3)',
          [loanId, facility.id, facility.quantity]
        );

        // Kurangi stok yang tersedia
        await client.query(
          'UPDATE assets SET available_stock = available_stock - $1 WHERE id = $2',
          [facility.quantity, facility.id]
        );
      }
    }

    await client.query('COMMIT');

    // Kembalikan response langsung
    return h.response({
      status: 'success',
      data: {
        loan: {
          id: loanId,
          message: 'Loan created successfully'
        }
      }
    }).code(201);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create loan error:', error);
    return h.response({
      status: 'error',
      message: 'Terjadi kesalahan server'
    }).code(500);
  } finally {
    client.release();
  }
}

  static async updateLoanStatus(request, h) {
    try {
      const { id } = request.params;
      const { status } = request.payload;

      const result = await query(
        'UPDATE loans SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id',
        [status, id]
      );

      if (result.rows.length === 0) {
        return h.response({
          status: 'error',
          message: 'Peminjaman tidak ditemukan'
        }).code(404);
      }

      return h.response({
        status: 'success',
        message: 'Status peminjaman berhasil diupdate'
      });
    } catch (error) {
      console.error('Update loan status error:', error);
      return h.response({
        status: 'error',
        message: 'Terjadi kesalahan server'
      }).code(500);
    }
  }

  static async deleteLoan(request, h) {
    // Implementasi delete loan
    // ... (serupa dengan yang lain)
  }
}

module.exports = LoanController;