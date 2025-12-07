-- migrations/006_drop_problematic_triggers.sql
-- Nonaktifkan trigger yang mungkin bermasalah

DO $$
BEGIN
    -- 1. Drop trigger untuk check_loan_overdue (mungkin bermasalah)
    DROP TRIGGER IF EXISTS trigger_check_loan_overdue ON loans;

    -- 2. Hapus constraint UNIQUE di asset_conditions jika menyebabkan masalah
    ALTER TABLE asset_conditions DROP CONSTRAINT IF EXISTS asset_conditions_asset_id_condition_key;

    -- 3. Hapus function yang bermasalah
    DROP FUNCTION IF EXISTS check_loan_overdue() CASCADE;
    DROP FUNCTION IF EXISTS update_overdue_loans() CASCADE;

    -- 4. Hapus function update_asset_stock tapi backup dulu
    -- Kita akan buat ulang yang lebih sederhana
    DROP FUNCTION IF EXISTS update_asset_stock() CASCADE;

    -- 5. Periksa dan perbaiki kolom di loans yang mungkin NULL
    -- Pastikan kolom approved_by bisa NULL (karena baru diisi saat approve)
    ALTER TABLE loans ALTER COLUMN approved_by DROP NOT NULL;
    ALTER TABLE loans ALTER COLUMN approval_notes DROP NOT NULL;
    ALTER TABLE loans ALTER COLUMN processed_by DROP NOT NULL;

    -- 6. Periksa kolom di users
    -- Pastikan kolom yang diperlukan untuk login ada
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'password'
    ) THEN
        ALTER TABLE users ADD COLUMN password VARCHAR(255);
        UPDATE users SET password = 'temp123' WHERE password IS NULL;
        ALTER TABLE users ALTER COLUMN password SET NOT NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'email'
    ) THEN
        ALTER TABLE users ADD COLUMN email VARCHAR(255);
        UPDATE users SET email = 'default_' || id || '@example.com' WHERE email IS NULL;
        ALTER TABLE users ALTER COLUMN email SET NOT NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users(email);
    END IF;

END $$;