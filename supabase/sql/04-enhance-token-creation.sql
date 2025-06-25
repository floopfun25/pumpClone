-- Enhanced Token Creation Features
-- Add advanced fields for token creation

-- Add new columns to tokens table for advanced features
ALTER TABLE public.tokens 
ADD COLUMN IF NOT EXISTS total_supply_custom BIGINT DEFAULT 1000000000,
ADD COLUMN IF NOT EXISTS creator_share_percentage DECIMAL(5,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS creator_tokens_allocated BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS creator_tokens_locked BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS creator_tokens_unlocked BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS lock_percentage DECIMAL(5,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS lock_duration_days INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS unlock_schedule TEXT, -- JSON string for gradual unlocks
ADD COLUMN IF NOT EXISTS lock_start_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS next_unlock_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS prebuy_sol_amount DECIMAL(10,4) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS prebuy_tokens_received BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS creation_settings JSONB DEFAULT '{}'; -- Store additional creation settings

-- Create token_locks table for tracking individual lock schedules
CREATE TABLE IF NOT EXISTS public.token_locks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token_id UUID NOT NULL REFERENCES public.tokens(id) ON DELETE CASCADE,
  locked_amount BIGINT NOT NULL,
  lock_type TEXT NOT NULL CHECK (lock_type IN ('creator', 'team', 'liquidity', 'marketing')),
  lock_duration_days INTEGER NOT NULL,
  lock_start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  unlock_date TIMESTAMP WITH TIME ZONE NOT NULL,
  unlock_percentage DECIMAL(5,2) DEFAULT 100.0,
  unlocked_amount BIGINT DEFAULT 0,
  status TEXT DEFAULT 'locked' CHECK (status IN ('locked', 'partially_unlocked', 'fully_unlocked')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create token_unlock_schedule table for gradual unlock mechanisms
CREATE TABLE IF NOT EXISTS public.token_unlock_schedule (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token_lock_id UUID NOT NULL REFERENCES public.token_locks(id) ON DELETE CASCADE,
  unlock_date TIMESTAMP WITH TIME ZONE NOT NULL,
  unlock_percentage DECIMAL(5,2) NOT NULL,
  unlock_amount BIGINT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  executed_at TIMESTAMP WITH TIME ZONE,
  transaction_signature TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_token_locks_token_id ON public.token_locks(token_id);
CREATE INDEX IF NOT EXISTS idx_token_locks_unlock_date ON public.token_locks(unlock_date);
CREATE INDEX IF NOT EXISTS idx_token_locks_status ON public.token_locks(status);
CREATE INDEX IF NOT EXISTS idx_token_unlock_schedule_token_lock_id ON public.token_unlock_schedule(token_lock_id);
CREATE INDEX IF NOT EXISTS idx_token_unlock_schedule_unlock_date ON public.token_unlock_schedule(unlock_date);
CREATE INDEX IF NOT EXISTS idx_token_unlock_schedule_status ON public.token_unlock_schedule(status);

-- Add triggers for updated_at columns
CREATE TRIGGER update_token_locks_updated_at 
  BEFORE UPDATE ON public.token_locks 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS for new tables
ALTER TABLE public.token_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_unlock_schedule ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Allow public read access on token_locks" ON public.token_locks
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated users to manage token locks" ON public.token_locks
  FOR ALL USING (true);

CREATE POLICY "Allow public read access on token_unlock_schedule" ON public.token_unlock_schedule
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated users to manage unlock schedules" ON public.token_unlock_schedule
  FOR ALL USING (true);

-- Grant permissions
GRANT ALL ON public.token_locks TO authenticated;
GRANT SELECT ON public.token_locks TO anon;
GRANT ALL ON public.token_unlock_schedule TO authenticated;
GRANT SELECT ON public.token_unlock_schedule TO anon;

-- Update existing tokens to have default values
UPDATE public.tokens 
SET 
  total_supply_custom = total_supply,
  creator_share_percentage = 0.0,
  creator_tokens_allocated = 0,
  creator_tokens_locked = 0,
  creator_tokens_unlocked = 0,
  lock_percentage = 0.0,
  lock_duration_days = 0,
  prebuy_sol_amount = 0.0,
  prebuy_tokens_received = 0,
  creation_settings = '{}'
WHERE total_supply_custom IS NULL;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Enhanced token creation schema updated successfully!';
  RAISE NOTICE 'New features: Custom supply, creator share, token locking, prebuy';
  RAISE NOTICE 'Tables created: token_locks, token_unlock_schedule';
END $$; 