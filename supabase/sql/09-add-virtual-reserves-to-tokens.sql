-- Add virtual reserves to the tokens table
-- These columns are crucial for trade calculations and previews.
-- Using NUMERIC to accommodate large u64 values from the Solana program.

ALTER TABLE public.tokens
ADD COLUMN IF NOT EXISTS virtual_sol_reserves NUMERIC,
ADD COLUMN IF NOT EXISTS virtual_token_reserves NUMERIC;

-- Set default values for existing tokens to avoid null issues.
-- The initial values should match the constants used in the bonding curve service.
-- See src/services/bondingCurve.ts and src/config/index.ts
UPDATE public.tokens
SET 
  virtual_sol_reserves = 30000000000, -- Corresponds to 30 SOL in lamports
  virtual_token_reserves = 1073000000 -- Initial virtual token reserves
WHERE 
  virtual_sol_reserves IS NULL OR virtual_token_reserves IS NULL;

-- Add a comment to explain the purpose of these columns
COMMENT ON COLUMN public.tokens.virtual_sol_reserves IS 'Stores the virtual SOL reserves of the bonding curve as a string to handle large numbers.';
COMMENT ON COLUMN public.tokens.virtual_token_reserves IS 'Stores the virtual token reserves of the bonding curve as a string to handle large numbers.'; 