-- migrations/004_add_approval_columns_to_loans.sql

DO $$
BEGIN
    -- Add approved_by column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'loans' AND column_name = 'approved_by'
    ) THEN
        ALTER TABLE loans ADD COLUMN approved_by UUID REFERENCES users(id);
        RAISE NOTICE '✅ Added approved_by column to loans table';
    ELSE
        RAISE NOTICE '✅ approved_by column already exists in loans table';
    END IF;

    -- Add approval_notes column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'loans' AND column_name = 'approval_notes'
    ) THEN
        ALTER TABLE loans ADD COLUMN approval_notes TEXT;
        RAISE NOTICE '✅ Added approval_notes column to loans table';
    ELSE
        RAISE NOTICE '✅ approval_notes column already exists in loans table';
    END IF;

    -- Add processed_by column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'loans' AND column_name = 'processed_by'
    ) THEN
        ALTER TABLE loans ADD COLUMN processed_by UUID REFERENCES users(id);
        RAISE NOTICE '✅ Added processed_by column to loans table';
    ELSE
        RAISE NOTICE '✅ processed_by column already exists in loans table';
    END IF;
END $$;