-- migrations/008_final_fix.sql
-- Perbaikan akhir untuk login dan struktur database

DO $$
DECLARE
    user_count INTEGER;
    admin_exists BOOLEAN;
BEGIN
    RAISE NOTICE '🔄 Memulai perbaikan database...';

    -- 1. Perbaiki tabel users untuk login
    RAISE NOTICE '1. Memperbaiki tabel users...';
    
    -- Pastikan kolom email ada
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'email'
    ) THEN
        ALTER TABLE users ADD COLUMN email VARCHAR(255);
        RAISE NOTICE '   - Kolom email ditambahkan';
    END IF;
    
    -- Set email default untuk user yang email-nya NULL
    UPDATE users SET email = 'user_' || id || '@example.com' WHERE email IS NULL;
    
    -- Buat email tidak boleh NULL
    ALTER TABLE users ALTER COLUMN email SET NOT NULL;
    
    -- Buat unique constraint untuk email
    BEGIN
        ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);
        RAISE NOTICE '   - Constraint unique untuk email ditambahkan';
    EXCEPTION WHEN duplicate_object THEN
        RAISE NOTICE '   - Constraint unique untuk email sudah ada';
    END;

    -- Pastikan kolom password ada
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'password'
    ) THEN
        ALTER TABLE users ADD COLUMN password VARCHAR(255);
        RAISE NOTICE '   - Kolom password ditambahkan';
    END IF;

    -- Set password default untuk user yang password-nya NULL
    UPDATE users SET password = '$2b$10$6Y./.sCjW5z7V7g8H9qZ0e1X2y3z4A5B6C7D8E9F0G1H2I3J4K5L6M7N8O9P0' WHERE password IS NULL;
    
    -- Buat password tidak boleh NULL
    ALTER TABLE users ALTER COLUMN password SET NOT NULL;

    -- Pastikan kolom role ada
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'role'
    ) THEN
        ALTER TABLE users ADD COLUMN role VARCHAR(50);
        UPDATE users SET role = 'mahasiswa' WHERE role IS NULL;
        ALTER TABLE users ALTER COLUMN role SET NOT NULL;
        RAISE NOTICE '   - Kolom role ditambahkan';
    END IF;

    -- 2. Hapus constraint yang bermasalah di asset_conditions
    RAISE NOTICE '2. Memperbaiki constraint...';
    
    BEGIN
        ALTER TABLE asset_conditions DROP CONSTRAINT IF EXISTS asset_conditions_asset_id_condition_key;
        RAISE NOTICE '   - Constraint asset_conditions_asset_id_condition_key dihapus';
    EXCEPTION WHEN others THEN
        RAISE NOTICE '   - Gagal menghapus constraint (mungkin tidak ada)';
    END;

    -- 3. Buat atau update user admin
    RAISE NOTICE '3. Membuat user admin...';
    
    SELECT COUNT(*) INTO user_count FROM users WHERE email = 'admin@buf.ac.id';
    admin_exists := (user_count > 0);
    
    IF admin_exists THEN
        -- Update password admin
        UPDATE users SET 
            password = '$2b$10$6Y./.sCjW5z7V7g8H9qZ0e1X2y3z4A5B6C7D8E9F0G1H2I3J4K5L6M7N8O9P0',
            name = 'Admin BUF',
            role = 'admin_buf',
            is_active = true
        WHERE email = 'admin@buf.ac.id';
        RAISE NOTICE '   - User admin diperbarui';
    ELSE
        -- Buat user admin baru
        INSERT INTO users (email, password, name, role, is_active, created_at, updated_at)
        VALUES (
            'admin@buf.ac.id',
            '$2b$10$6Y./.sCjW5z7V7g8H9qZ0e1X2y3z4A5B6C7D8E9F0G1H2I3J4K5L6M7N8O9P0',
            'Admin BUF',
            'admin_buf',
            true,
            NOW(),
            NOW()
        );
        RAISE NOTICE '   - User admin dibuat';
    END IF;

    -- 4. Tampilkan statistik
    RAISE NOTICE '4. Statistik database:';
    
    SELECT COUNT(*) INTO user_count FROM users;
    RAISE NOTICE '   - Total users: %', user_count;
    
    DECLARE
        asset_count INTEGER;
        loan_count INTEGER;
    BEGIN
        SELECT COUNT(*) INTO asset_count FROM assets;
        RAISE NOTICE '   - Total assets: %', asset_count;
        
        SELECT COUNT(*) INTO loan_count FROM loans;
        RAISE NOTICE '   - Total loans: %', loan_count;
    EXCEPTION WHEN others THEN
        RAISE NOTICE '   - Tidak dapat menghitung assets/loans';
    END;

    RAISE NOTICE '✅ Perbaikan database selesai!';
    
EXCEPTION WHEN others THEN
    RAISE NOTICE '❌ Error dalam perbaikan database: %', SQLERRM;
END $$;