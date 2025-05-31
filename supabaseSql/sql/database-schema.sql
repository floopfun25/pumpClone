-- Database schema for FloppFun Phase 1 features
-- Add these tables to your Supabase database

-- Token Comments Table
CREATE TABLE IF NOT EXISTS token_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token_id UUID NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (length(content) > 0 AND length(content) <= 500),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Comment Likes Table
CREATE TABLE IF NOT EXISTS comment_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id UUID NOT NULL REFERENCES token_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one like per user per comment
  UNIQUE(comment_id, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_token_comments_token_id ON token_comments(token_id);
CREATE INDEX IF NOT EXISTS idx_token_comments_created_at ON token_comments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comment_likes_comment_id ON comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_likes_user_id ON comment_likes(user_id);

-- Update tokens table with new fields if not exists
ALTER TABLE tokens 
ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS is_nsfw BOOLEAN DEFAULT FALSE;

-- Update users table with username field if not exists
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS username TEXT,
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS twitter_handle TEXT,
ADD COLUMN IF NOT EXISTS telegram_handle TEXT,
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS reputation_score INTEGER DEFAULT 0;

-- Row Level Security (RLS) Policies

-- Enable RLS on new tables
ALTER TABLE token_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist, then create new ones
DROP POLICY IF EXISTS "Anyone can view comments" ON token_comments;
DROP POLICY IF EXISTS "Authenticated users can create comments" ON token_comments;
DROP POLICY IF EXISTS "Users can update their own comments" ON token_comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON token_comments;

-- Comments policies
CREATE POLICY "Anyone can view comments" ON token_comments FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create comments" ON token_comments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update their own comments" ON token_comments FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete their own comments" ON token_comments FOR DELETE USING (user_id = auth.uid());

-- Drop existing comment likes policies
DROP POLICY IF EXISTS "Anyone can view comment likes" ON comment_likes;
DROP POLICY IF EXISTS "Authenticated users can like comments" ON comment_likes;
DROP POLICY IF EXISTS "Users can remove their own likes" ON comment_likes;

-- Comment likes policies
CREATE POLICY "Anyone can view comment likes" ON comment_likes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can like comments" ON comment_likes FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can remove their own likes" ON comment_likes FOR DELETE USING (user_id = auth.uid());

-- Function to update updated_at timestamp
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing trigger if it exists, then create new one
DROP TRIGGER IF EXISTS update_token_comments_updated_at ON token_comments;

-- Trigger for token_comments updated_at
CREATE TRIGGER update_token_comments_updated_at 
  BEFORE UPDATE ON token_comments 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Sample data for testing (optional)
-- INSERT INTO token_comments (token_id, user_id, content) VALUES
-- ('token-uuid-here', 'user-uuid-here', 'Great token! Going to the moon! 🚀'); 

-- Add conversations table
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user1_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user2_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes to prevent duplicate conversations (both directions)
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_user1_user2 
ON public.conversations (user1_id, user2_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_user2_user1 
ON public.conversations (user2_id, user1_id);

-- Add messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_conversations_users ON public.conversations(user1_id, user2_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON public.conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON public.messages(receiver_id, read) WHERE read = FALSE;

-- Enable RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies for conversations
DROP POLICY IF EXISTS "Users can view their own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;

-- RLS Policies for conversations
CREATE POLICY "Users can view their own conversations" ON public.conversations
  FOR SELECT USING (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "Users can create conversations" ON public.conversations
  FOR INSERT WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Drop existing policies for messages
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
DROP POLICY IF EXISTS "Users can update their received messages" ON public.messages;

-- RLS Policies for messages
CREATE POLICY "Users can view messages in their conversations" ON public.messages
  FOR SELECT USING (
    auth.uid() = sender_id OR 
    auth.uid() = receiver_id
  );

CREATE POLICY "Users can send messages" ON public.messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update their received messages" ON public.messages
  FOR UPDATE USING (auth.uid() = receiver_id);

-- Add creator incentive tracking fields to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS creator_tier TEXT DEFAULT 'bronze' CHECK (creator_tier IN ('bronze', 'silver', 'gold', 'diamond'));
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS creator_level INTEGER DEFAULT 1;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS total_earned NUMERIC(10,4) DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS monthly_rewards NUMERIC(10,4) DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS tokens_created INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS followers_count INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS comments_count INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS helpful_votes INTEGER DEFAULT 0;

-- Add share tracking fields to tokens
ALTER TABLE public.tokens ADD COLUMN IF NOT EXISTS share_count INTEGER DEFAULT 0;
ALTER TABLE public.tokens ADD COLUMN IF NOT EXISTS last_shared_at TIMESTAMP WITH TIME ZONE;

-- Create share tracking table
CREATE TABLE IF NOT EXISTS public.token_shares (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token_id UUID NOT NULL REFERENCES public.tokens(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  platform TEXT NOT NULL CHECK (platform IN ('twitter', 'telegram', 'discord', 'reddit', 'copy-link')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for shares
ALTER TABLE public.token_shares ENABLE ROW LEVEL SECURITY;

-- Drop existing policies for token_shares
DROP POLICY IF EXISTS "Anyone can view share counts" ON public.token_shares;
DROP POLICY IF EXISTS "Users can track their shares" ON public.token_shares;

CREATE POLICY "Anyone can view share counts" ON public.token_shares
  FOR SELECT USING (true);

CREATE POLICY "Users can track their shares" ON public.token_shares
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_token_shares_token ON public.token_shares(token_id);
CREATE INDEX IF NOT EXISTS idx_token_shares_user ON public.token_shares(user_id);
CREATE INDEX IF NOT EXISTS idx_token_shares_platform ON public.token_shares(platform);

-- Update function to automatically update conversation timestamps
DROP FUNCTION IF EXISTS update_conversation_timestamp() CASCADE;

CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.conversations 
  SET updated_at = timezone('utc'::text, now())
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql; 