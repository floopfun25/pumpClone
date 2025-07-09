-- Create portfolio_snapshots table for tracking daily portfolio values
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.portfolio_snapshots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    total_value DECIMAL(20,10) NOT NULL DEFAULT 0,
    sol_balance DECIMAL(20,10) NOT NULL DEFAULT 0,
    sol_value DECIMAL(20,10) NOT NULL DEFAULT 0,
    token_value DECIMAL(20,10) NOT NULL DEFAULT 0,
    token_count INTEGER NOT NULL DEFAULT 0,
    snapshot_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_user_id ON public.portfolio_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_date ON public.portfolio_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_user_date ON public.portfolio_snapshots(user_id, snapshot_date);

-- Ensure unique constraint for user per day
CREATE UNIQUE INDEX IF NOT EXISTS idx_portfolio_snapshots_user_date_unique 
ON public.portfolio_snapshots(user_id, snapshot_date);

-- Enable RLS
ALTER TABLE public.portfolio_snapshots ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own portfolio snapshots" ON public.portfolio_snapshots;
DROP POLICY IF EXISTS "Users can insert their own portfolio snapshots" ON public.portfolio_snapshots;
DROP POLICY IF EXISTS "Users can update their own portfolio snapshots" ON public.portfolio_snapshots;
DROP POLICY IF EXISTS "Allow user to read their own snapshots" ON public.portfolio_snapshots;
DROP POLICY IF EXISTS "Allow user to insert their own snapshots" ON public.portfolio_snapshots;
DROP POLICY IF EXISTS "Allow user to update their own snapshots" ON public.portfolio_snapshots;


-- Create RLS policies
CREATE POLICY "Allow user to read their own snapshots" ON public.portfolio_snapshots
    FOR SELECT USING (get_my_user_id() = user_id);

CREATE POLICY "Allow user to insert their own snapshots" ON public.portfolio_snapshots
    FOR INSERT WITH CHECK (get_my_user_id() = user_id);

CREATE POLICY "Allow user to update their own snapshots" ON public.portfolio_snapshots
    FOR UPDATE USING (get_my_user_id() = user_id);


-- Grant permissions
GRANT ALL ON public.portfolio_snapshots TO authenticated;
-- It's safer to not allow anon users to select from this table.
-- GRANT SELECT ON public.portfolio_snapshots TO anon;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_portfolio_snapshots_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS portfolio_snapshots_updated_at ON public.portfolio_snapshots;
CREATE TRIGGER portfolio_snapshots_updated_at
    BEFORE UPDATE ON public.portfolio_snapshots
    FOR EACH ROW
    EXECUTE FUNCTION update_portfolio_snapshots_updated_at();

-- Show results
SELECT 'portfolio_snapshots table created successfully!' as status; 