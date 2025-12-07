-- migrations/005_add_overdue_trigger.sql
-- Trigger untuk otomatis update status ketika peminjaman melewati tanggal selesai

-- Fungsi untuk update status overdue
CREATE OR REPLACE FUNCTION update_overdue_loans()
RETURNS void AS $$
BEGIN
  UPDATE loans 
  SET status = 'menunggu_pengembalian', 
      updated_at = CURRENT_TIMESTAMP
  WHERE status = 'disetujui' 
    AND end_date < CURRENT_DATE
    AND returned_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Event trigger yang dijalankan setiap hari (menggunakan pg_cron jika tersedia)
-- Jika pg_cron tidak tersedia, kita bisa membuat scheduled job di aplikasi
COMMENT ON FUNCTION update_overdue_loans() IS 'Update status peminjaman yang sudah lewat tanggal selesai menjadi menunggu_pengembalian';

-- Trigger untuk mengecek setiap insert/update di loans
CREATE OR REPLACE FUNCTION check_loan_overdue()
RETURNS TRIGGER AS $$
BEGIN
  -- Jika end_date sudah lewat dan status masih disetujui
  IF NEW.end_date < CURRENT_DATE AND NEW.status = 'disetujui' THEN
    NEW.status := 'menunggu_pengembalian';
    NEW.updated_at := CURRENT_TIMESTAMP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger BEFORE INSERT atau UPDATE
DROP TRIGGER IF EXISTS trigger_check_loan_overdue ON loans;
CREATE TRIGGER trigger_check_loan_overdue
BEFORE INSERT OR UPDATE ON loans
FOR EACH ROW
EXECUTE FUNCTION check_loan_overdue();

-- Job untuk menjalankan update setiap hari jam 00:01
-- Catatan: Ini membutuhkan extension pg_cron
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- SELECT cron.schedule('0 1 * * *', 'SELECT update_overdue_loans();');

RAISE NOTICE '✅ Overdue loan trigger created successfully!';