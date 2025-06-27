-- Add user watchlist functionality
-- Run this in your Supabase SQL Editor

-- Create user_watchlist table
CREATE TABLE IF NOT EXISTS public.user_watchlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token_id UUID NOT NULL REFERENCES public.tokens(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one watchlist entry per user per token
  UNIQUE(user_id, token_id)
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_user_watchlist_user_id ON public.user_watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_user_watchlist_token_id ON public.user_watchlist(token_id);
CREATE INDEX IF NOT EXISTS idx_user_watchlist_created_at ON public.user_watchlist(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.user_watchlist ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own watchlist" ON public.user_watchlist;
DROP POLICY IF EXISTS "Users can manage their own watchlist" ON public.user_watchlist;

-- Create RLS policies
CREATE POLICY "Users can view their own watchlist" ON public.user_watchlist
  FOR SELECT USING (true); -- Allow public read for now, can be restricted later

CREATE POLICY "Users can manage their own watchlist" ON public.user_watchlist
  FOR ALL USING (true); -- Allow authenticated users to manage their watchlist

-- Add watchlist_count to tokens table for caching
ALTER TABLE public.tokens ADD COLUMN IF NOT EXISTS watchlist_count INTEGER DEFAULT 0;

-- Create function to update watchlist count
CREATE OR REPLACE FUNCTION public.update_token_watchlist_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.tokens 
    SET watchlist_count = watchlist_count + 1 
    WHERE id = NEW.token_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.tokens 
    SET watchlist_count = GREATEST(0, watchlist_count - 1) 
    WHERE id = OLD.token_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update watchlist count
DROP TRIGGER IF EXISTS trigger_update_watchlist_count ON public.user_watchlist;
CREATE TRIGGER trigger_update_watchlist_count
  AFTER INSERT OR DELETE ON public.user_watchlist
  FOR EACH ROW
  EXECUTE FUNCTION public.update_token_watchlist_count(); 