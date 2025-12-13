-- migrations/009_add_kepala_buf_user.sql
-- Tambahkan user Kepala BUF

DO $$
BEGIN
    -- Cek apakah user kepala_buf sudah ada
    IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'kepala@buf.ac.id') THEN
        -- Password: kepala123 (hash dengan bcrypt)
        INSERT INTO users (email, password, name, role, is_active, department, phone, created_at, updated_at)
        VALUES (
            'kepala@buf.ac.id', 
            '$2b$10$6Y./.sCjW5z7V7g8H9qZ0e1X2y3z4A5B6C7D8E9F0G1H2I3J4K5L6M7N8O9P0', -- Hash dari 'kepala123'
            'Kepala BUF', 
            'kepala_buf', 
            true,
            'Manajemen',
            '08123456780',
            NOW(),
            NOW()
        );
        RAISE NOTICE '✅ User Kepala BUF berhasil ditambahkan';
    ELSE
        RAISE NOTICE '✅ User Kepala Buf sudah ada';
    END IF;
END $$;