// utils/cron.js - VERSI DIPERBAIKI
const { query } = require('../config/database'); // PERBAIKI PATH
const schedule = require('node-schedule');

// Fungsi untuk update overdue loans
async function updateOverdueLoans() {
  try {
    console.log('🔄 [CRON] Checking for overdue loans...');
    
    const result = await query(`
      UPDATE loans 
      SET status = 'menunggu_pengembalian', 
          updated_at = CURRENT_TIMESTAMP
      WHERE status = 'disetujui' 
        AND end_date < CURRENT_DATE
        AND returned_at IS NULL
      RETURNING id, borrower_id, end_date
    `);
    
    if (result.rows.length > 0) {
      console.log(`🔄 [CRON] Updated ${result.rows.length} overdue loans to 'menunggu_pengembalian'`);
      console.log('Updated loans:', result.rows.map(r => ({
        id: r.id,
        borrower_id: r.borrower_id,
        end_date: r.end_date
      })));
    } else {
      console.log('✅ [CRON] No overdue loans found');
    }
    
    return result.rows;
  } catch (error) {
    console.error('❌ [CRON] Error updating overdue loans:', error);
    return [];
  }
}

// Jadwalkan cron job untuk berjalan setiap hari jam 00:01
function startCronJobs() {
  console.log('⏰ Starting cron jobs...');
  
  // Jalankan segera saat server start
  setTimeout(() => {
    updateOverdueLoans();
  }, 5000); // Tunggu 5 detik agar database siap
  
  // Jadwalkan setiap hari jam 00:01
  schedule.scheduleJob('1 0 * * *', updateOverdueLoans);
  
  console.log('✅ Cron jobs scheduled: Overdue loan check at 00:01 daily');
}

module.exports = { updateOverdueLoans, startCronJobs };