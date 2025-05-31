-- Create token_price_history table for chart data
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.token_price_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    token_id UUID NOT NULL REFERENCES public.tokens(id) ON DELETE CASCADE,
    price DECIMAL(20,10) NOT NULL,
    volume DECIMAL(20,10) DEFAULT 0,
    market_cap BIGINT DEFAULT 0,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_token_price_history_token_id ON public.token_price_history(token_id);
CREATE INDEX IF NOT EXISTS idx_token_price_history_timestamp ON public.token_price_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_token_price_history_token_timestamp ON public.token_price_history(token_id, timestamp);

-- Enable RLS
ALTER TABLE public.token_price_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Allow public read access on token_price_history" ON public.token_price_history
    FOR SELECT USING (true);

CREATE POLICY "Allow authenticated users to insert price history" ON public.token_price_history
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Grant permissions
GRANT ALL ON public.token_price_history TO authenticated;
GRANT SELECT ON public.token_price_history TO anon;

-- Show results
SELECT 'token_price_history table created successfully!' as status; 