-- migrations/001_create_tables.sql
-- LasalleServe Database Schema - PERBAIKI

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN (
        'mahasiswa', 'dosen', 'staf', 'civitas', 'staf_buf', 'admin_buf', 'kepala_buf'
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
    description TEXT,
    acquisition_year VARCHAR(9),
    semester VARCHAR(20), -- TAMBAHKAN KOLOM INI
    total_stock INTEGER NOT NULL DEFAULT 0,
    available_stock INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CHECK (available_stock <= total_stock AND available_stock >= 0)
);

-- Table: asset_conditions
CREATE TABLE IF NOT EXISTS asset_conditions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
    condition VARCHAR(50) NOT NULL CHECK (condition IN ('baik', 'rusak_ringan', 'rusak_berat')),
    quantity INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(asset_id, condition)
);

-- Table: loans
CREATE TABLE IF NOT EXISTS loans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    borrower_id UUID REFERENCES users(id) NOT NULL,
    room_id UUID REFERENCES assets(id),
    purpose TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    start_time TIME DEFAULT '08:00',
    end_time TIME DEFAULT '17:00',
    status VARCHAR(50) NOT NULL DEFAULT 'menunggu' CHECK (status IN (
        'menunggu', 'disetujui', 'ditolak', 'selesai', 'menunggu_pengembalian'
    )),
    academic_year VARCHAR(9),
    semester VARCHAR(20),
    returned_at TIMESTAMP WITH TIME ZONE,
    return_notes TEXT,
    approved_by UUID REFERENCES users(id),
    approval_notes TEXT,
    processed_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CHECK (end_date >= start_date)
);

-- Table: loan_items
CREATE TABLE IF NOT EXISTS loan_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loan_id UUID REFERENCES loans(id) ON DELETE CASCADE,
    asset_id UUID REFERENCES assets(id) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    returned_condition VARCHAR(50) CHECK (returned_condition IN (
        'baik', 'rusak_ringan', 'rusak_berat', 'hilang'
    )),
    returned_quantity INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: damage_reports
CREATE TABLE IF NOT EXISTS damage_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID REFERENCES assets(id) NOT NULL,
    reported_by UUID REFERENCES users(id) NOT NULL,
    description TEXT NOT NULL,
    priority VARCHAR(50) NOT NULL CHECK (priority IN ('rendah', 'sedang', 'tinggi')),
    status VARCHAR(50) NOT NULL DEFAULT 'menunggu' CHECK (status IN ('menunggu', 'dalam_perbaikan', 'selesai')),
    photo_url TEXT,
    notes TEXT,
    academic_year VARCHAR(9),
    semester VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_assets_category ON assets(category);
CREATE INDEX IF NOT EXISTS idx_assets_location ON assets(location);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
CREATE INDEX IF NOT EXISTS idx_loans_borrower_id ON loans(borrower_id);
CREATE INDEX IF NOT EXISTS idx_loans_dates ON loans(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_damage_reports_status ON damage_reports(status);
CREATE INDEX IF NOT EXISTS idx_damage_reports_priority ON damage_reports(priority);
CREATE INDEX IF NOT EXISTS idx_asset_conditions_asset ON asset_conditions(asset_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON assets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_asset_conditions_updated_at BEFORE UPDATE ON asset_conditions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_loans_updated_at BEFORE UPDATE ON loans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_damage_reports_updated_at BEFORE UPDATE ON damage_reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update asset stock automatically
CREATE OR REPLACE FUNCTION update_asset_stock()
RETURNS TRIGGER AS $$
BEGIN
    -- Update total_stock and available_stock
    UPDATE assets 
    SET 
        total_stock = (
            SELECT COALESCE(SUM(quantity), 0) 
            FROM asset_conditions 
            WHERE asset_id = NEW.asset_id
        ),
        available_stock = (
            SELECT COALESCE(SUM(quantity), 0)
            FROM asset_conditions 
            WHERE asset_id = NEW.asset_id AND condition = 'baik'
        )
    WHERE id = NEW.asset_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for asset stock update
CREATE TRIGGER update_stock_on_condition_change
    AFTER INSERT OR UPDATE OR DELETE ON asset_conditions
    FOR EACH ROW EXECUTE FUNCTION update_asset_stock();

-- Print success message
DO $$ 
BEGIN
    RAISE NOTICE '✅ LasalleServe database schema created successfully!';
END $$;