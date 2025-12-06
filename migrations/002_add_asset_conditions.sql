-- FIX SCHEMA CONSISTENCY
-- Pastikan semua tabel memiliki academic_year dan semester

-- 1. Assets table
ALTER TABLE assets 
ADD COLUMN IF NOT EXISTS academic_year VARCHAR(9),
ADD COLUMN IF NOT EXISTS semester VARCHAR(10) CHECK (semester IN ('Ganjil', 'Genap'));

-- 2. Asset conditions table
CREATE TABLE IF NOT EXISTS asset_conditions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
    condition VARCHAR(50) NOT NULL CHECK (condition IN ('baik', 'rusak_ringan', 'rusak_berat')),
    quantity INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(asset_id, condition)
);

-- 3. Update loans table
ALTER TABLE loans 
ALTER COLUMN semester TYPE VARCHAR(10),
ADD CONSTRAINT semester_check CHECK (semester IN ('Ganjil', 'Genap'));

-- 4. Update damage_reports table
ALTER TABLE damage_reports 
ADD COLUMN IF NOT EXISTS academic_year VARCHAR(9),
ADD COLUMN IF NOT EXISTS semester VARCHAR(10) CHECK (semester IN ('Ganjil', 'Genap'));

-- 5. Function untuk menghitung stock otomatis
CREATE OR REPLACE FUNCTION update_asset_stocks()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE assets a
    SET 
        total_stock = (
            SELECT COALESCE(SUM(ac.quantity), 0)
            FROM asset_conditions ac
            WHERE ac.asset_id = a.id
        ),
        available_stock = (
            SELECT COALESCE(SUM(ac.quantity), 0)
            FROM asset_conditions ac
            WHERE ac.asset_id = a.id AND ac.condition = 'baik'
        )
    WHERE a.id = COALESCE(NEW.asset_id, OLD.asset_id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Trigger untuk asset_conditions
DROP TRIGGER IF EXISTS update_stock_on_condition_change ON asset_conditions;
CREATE TRIGGER update_stock_on_condition_change
    AFTER INSERT OR UPDATE OR DELETE ON asset_conditions
    FOR EACH ROW EXECUTE FUNCTION update_asset_stocks();

-- 7. Migrate existing data
DO $$
DECLARE
    asset_record RECORD;
BEGIN
    -- Pindahkan data condition ke asset_conditions
    FOR asset_record IN SELECT * FROM assets WHERE condition IS NOT NULL LOOP
        INSERT INTO asset_conditions (asset_id, condition, quantity)
        VALUES (asset_record.id, asset_record.condition, asset_record.total_stock)
        ON CONFLICT (asset_id, condition) DO NOTHING;
    END LOOP;
    
    RAISE NOTICE '✅ Data migration completed!';
END $$;

-- 8. Hapus kolom condition lama dari assets
ALTER TABLE assets DROP COLUMN IF EXISTS condition;

-- 9. Create index untuk performance
CREATE INDEX IF NOT EXISTS idx_loans_returned ON loans(returned_at);
CREATE INDEX IF NOT EXISTS idx_asset_conditions_asset ON asset_conditions(asset_id);
CREATE INDEX IF NOT EXISTS idx_loans_academic_year ON loans(academic_year, semester);

RAISE NOTICE '🎉 Database schema updated successfully!';