-- migrations/003_add_semester_to_assets.sql
-- Add semester column to assets table

DO $$
BEGIN
    -- Add semester column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'assets' AND column_name = 'semester'
    ) THEN
        ALTER TABLE assets ADD COLUMN semester VARCHAR(20);
        RAISE NOTICE '✅ Added semester column to assets table';
    ELSE
        RAISE NOTICE '✅ Semester column already exists in assets table';
    END IF;

    -- Add acquisition_year column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'assets' AND column_name = 'acquisition_year'
    ) THEN
        ALTER TABLE assets ADD COLUMN acquisition_year VARCHAR(9);
        RAISE NOTICE '✅ Added acquisition_year column to assets table';
    ELSE
        RAISE NOTICE '✅ acquisition_year column already exists in assets table';
    END IF;

    -- Make sure total_stock and available_stock columns exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'assets' AND column_name = 'total_stock'
    ) THEN
        ALTER TABLE assets ADD COLUMN total_stock INTEGER DEFAULT 0;
        RAISE NOTICE '✅ Added total_stock column to assets table';
    END IF;

    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'assets' AND column_name = 'available_stock'
    ) THEN
        ALTER TABLE assets ADD COLUMN available_stock INTEGER DEFAULT 0;
        RAISE NOTICE '✅ Added available_stock column to assets table';
    END IF;

END $$;