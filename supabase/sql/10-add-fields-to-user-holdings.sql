-- Add total_invested and last_updated to user_holdings table

ALTER TABLE public.user_holdings
ADD COLUMN IF NOT EXISTS total_invested NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP WITH TIME ZONE;

-- Add comments for clarity
COMMENT ON COLUMN public.user_holdings.total_invested IS 'The total amount of SOL invested by the user in this token.';
COMMENT ON COLUMN public.user_holdings.last_updated IS 'The timestamp of the last update to the holding record.'; 