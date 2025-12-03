-- migrations/001_create_tables.sql
-- LasalleServe Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN (
        'mahasiswa', 'dosen', 'staf', 'staf_buf', 'admin_buf', 'kepala_buf'
    )),
    department VARCHAR(255),
    student_id VARCHAR(100),
    phone VARCHAR(20),
    ktm_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: assets
CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('ruangan', 'fasilitas')),
    location VARCHAR(255) NOT NULL,
    total_stock INTEGER NOT NULL DEFAULT 0,
    available_stock INTEGER NOT NULL DEFAULT 0,
    condition VARCHAR(50) NOT NULL CHECK (condition IN ('baik', 'rusak_ringan', 'rusak_berat')),
    description TEXT,
    acquisition_year VARCHAR(9),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CHECK (available_stock <= total_stock AND available_stock >= 0)
);

-- Table: loans
CREATE TABLE IF NOT EXISTS loans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    borrower_id UUID REFERENCES users(id) NOT NULL,
    room_id UUID REFERENCES assets(id),
    purpose TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    status VARCHAR(50) NOT NULL CHECK (status IN (
        'menunggu', 'disetujui', 'ditolak', 'selesai', 'menunggu_pengembalian'
    )),
    academic_year VARCHAR(9) NOT NULL,
    semester VARCHAR(10) NOT NULL CHECK (semester IN ('ganjil', 'genap')),
    returned_at TIMESTAMP WITH TIME ZONE,
    return_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CHECK (end_date >= start_date)
);

-- Table: loan_items (for facilities)
CREATE TABLE IF NOT EXISTS loan_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loan_id UUID REFERENCES loans(id) ON DELETE CASCADE,
    asset_id UUID REFERENCES assets(id) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    returned_condition VARCHAR(50) CHECK (returned_condition IN (
        'baik', 'rusak_ringan', 'rusak_berat', 'hilang'
    )),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: damage_reports
CREATE TABLE IF NOT EXISTS damage_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID REFERENCES assets(id) NOT NULL,
    reported_by UUID REFERENCES users(id) NOT NULL,
    description TEXT NOT NULL,
    priority VARCHAR(50) NOT NULL CHECK (priority IN ('rendah', 'sedang', 'tinggi')),
    status VARCHAR(50) NOT NULL CHECK (status IN ('menunggu', 'dalam_perbaikan', 'selesai')),
    photo_url TEXT,
    notes TEXT,
    academic_year VARCHAR(9),
    semester VARCHAR(10) CHECK (semester IN ('ganjil', 'genap')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for perfrmance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_assets_category ON assets(category);
CREATE INDEX IF NOT EXISTS idx_assets_location ON assets(location);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
CREATE INDEX IF NOT EXISTS idx_loans_borrower_id ON loans(borrower_id);
CREATE INDEX IF NOT EXISTS idx_loans_dates ON loans(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_damage_reports_status ON damage_reports(status);
CREATE INDEX IF NOT EXISTS idx_damage_reports_priority ON damage_reports(priority);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON assets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_loans_updated_at BEFORE UPDATE ON loans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_damage_reports_updated_at BEFORE UPDATE ON damage_reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Print success message
DO $$ 
BEGIN
    RAISE NOTICE '✅ LasalleServe database schema created successfully!';
END $$;

-- Pastikan kolom berikut ada di tabel loans
ALTER TABLE loans ADD COLUMN IF NOT EXISTS returned_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS return_notes TEXT;

-- Pastikan kolom berikut ada di tabel loan_items
ALTER TABLE loan_items ADD COLUMN IF NOT EXISTS returned_condition VARCHAR(50);

-- Pastikan kolom berikut ada di tabel assets
ALTER TABLE assets ADD COLUMN IF NOT EXISTS acquisition_year VARCHAR(9);

-- Pastikan kolom berikut ada di tabel damage_reports
ALTER TABLE damage_reports ADD COLUMN IF NOT EXISTS academic_year VARCHAR(9);
ALTER TABLE damage_reports ADD COLUMN IF NOT EXISTS semester VARCHAR(10);