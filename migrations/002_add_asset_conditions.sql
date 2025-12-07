-- File baru: migrations/002_add_asset_conditions.sql

-- Hapus kolom condition dari assets
ALTER TABLE assets DROP COLUMN IF EXISTS condition;

-- Tambah tabel asset_conditions
CREATE TABLE IF NOT EXISTS asset_conditions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
    condition VARCHAR(50) NOT NULL CHECK (condition IN ('baik', 'rusak_ringan', 'rusak_berat')),
    quantity INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(asset_id, condition)
);

-- Trigger untuk update timestamp
CREATE TRIGGER update_asset_conditions_updated_at 
    BEFORE UPDATE ON asset_conditions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function untuk menghitung total dan available stock
CREATE OR REPLACE FUNCTION update_asset_stock()
RETURNS TRIGGER AS $$
BEGIN
    -- Update total_stock (jumlah semua kondisi)
    UPDATE assets 
    SET total_stock = (
        SELECT COALESCE(SUM(quantity), 0) 
        FROM asset_conditions 
        WHERE asset_id = NEW.asset_id
    ),
    available_stock = (
        SELECT COALESCE(quantity, 0)
        FROM asset_conditions 
        WHERE asset_id = NEW.asset_id AND condition = 'baik'
    )
    WHERE id = NEW.asset_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger untuk update stock otomatis
CREATE TRIGGER update_stock_on_condition_change
    AFTER INSERT OR UPDATE OR DELETE ON asset_conditions
    FOR EACH ROW EXECUTE FUNCTION update_asset_stock();

-- Pindahkan data existing
DO $$
DECLARE
    asset_record RECORD;
BEGIN
    FOR asset_record IN SELECT * FROM assets LOOP
        INSERT INTO asset_conditions (asset_id, condition, quantity)
        VALUES (asset_record.id, 'baik', asset_record.available_stock);
        
        IF asset_record.total_stock > asset_record.available_stock THEN
            INSERT INTO asset_conditions (asset_id, condition, quantity)
            VALUES (asset_record.id, 'rusak_ringan', 
                   asset_record.total_stock - asset_record.available_stock);
        END IF;
    END LOOP;
END $$;

RAISE NOTICE '✅ Asset conditions migration completed!';