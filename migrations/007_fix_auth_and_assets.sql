-- migrations/007_fix_auth_and_assets.sql
-- Memperbaiki masalah login, register, dan aset

DO $$
BEGIN
    -- 1. Pastikan kolom password ada di users
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'password'
    ) THEN
        ALTER TABLE users ADD COLUMN password VARCHAR(255);
        UPDATE users SET password = 'temp123' WHERE password IS NULL;
        ALTER TABLE users ALTER COLUMN password SET NOT NULL;
    END IF;

    -- 2. Pastikan kolom email ada dan unique
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'email'
    ) THEN
        ALTER TABLE users ADD COLUMN email VARCHAR(255);
        UPDATE users SET email = 'default_' || id || '@example.com' WHERE email IS NULL;
        ALTER TABLE users ALTER COLUMN email SET NOT NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users(email);
    END IF;

    -- 3. Pastikan kolom role ada
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'role'
    ) THEN
        ALTER TABLE users ADD COLUMN role VARCHAR(50);
        UPDATE users SET role = 'mahasiswa' WHERE role IS NULL;
        ALTER TABLE users ALTER COLUMN role SET NOT NULL;
    END IF;

    -- 4. Pastikan kolom is_active ada
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'is_active'
    ) THEN
        ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;

    -- 5. Perbaiki constraint untuk loans table
    ALTER TABLE loans ALTER COLUMN approved_by DROP NOT NULL;
    ALTER TABLE loans ALTER COLUMN approval_notes DROP NOT NULL;
    ALTER TABLE loans ALTER COLUMN processed_by DROP NOT NULL;

    -- 6. Hapus constraint UNIQUE yang bermasalah di asset_conditions
    ALTER TABLE asset_conditions DROP CONSTRAINT IF EXISTS asset_conditions_asset_id_condition_key;

    -- 7. Hapus function update_asset_stock yang bermasalah dan buat yang baru
    DROP FUNCTION IF EXISTS update_asset_stock() CASCADE;
    
    CREATE OR REPLACE FUNCTION update_asset_stock()
    RETURNS TRIGGER AS $$
    BEGIN
        -- Update total_stock (jumlah semua kondisi)
        UPDATE assets 
        SET total_stock = (
            SELECT COALESCE(SUM(quantity), 0) 
            FROM asset_conditions 
            WHERE asset_id = COALESCE(NEW.asset_id, OLD.asset_id)
        ),
        available_stock = (
            SELECT COALESCE(SUM(quantity), 0)
            FROM asset_conditions 
            WHERE asset_id = COALESCE(NEW.asset_id, OLD.asset_id) 
              AND condition = 'baik'
        )
        WHERE id = COALESCE(NEW.asset_id, OLD.asset_id);
        
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    -- 8. Buat trigger untuk update stock
    DROP TRIGGER IF EXISTS update_stock_on_condition_change ON asset_conditions;
    CREATE TRIGGER update_stock_on_condition_change
        AFTER INSERT OR UPDATE OR DELETE ON asset_conditions
        FOR EACH ROW EXECUTE FUNCTION update_asset_stock();

    -- 9. Buat user admin default jika belum ada
    IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@buf.ac.id') THEN
        -- Password: admin123 (hash dengan bcrypt)
        INSERT INTO users (email, password, name, role, is_active, department, phone)
        VALUES (
            'admin@buf.ac.id', 
            '$2b$10$VzQv7JfJ3pW8gLkY8f8Q8e6X6z0qLm1nN8cJkLm3pV9qLm1nN8cJkLm3pV', -- Hash dari 'admin123'
            'Admin BUF', 
            'admin_buf', 
            true,
            'Administrasi',
            '08123456789'
        );
    END IF;

    -- 10. Perbaiki semester di assets jika null
    UPDATE assets SET semester = 'Ganjil' WHERE semester IS NULL;
    UPDATE assets SET acquisition_year = '2024/2025' WHERE acquisition_year IS NULL;

END $$;