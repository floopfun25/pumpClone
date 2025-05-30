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

-- Comments policies
CREATE POLICY "Anyone can view comments" ON token_comments FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create comments" ON token_comments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update their own comments" ON token_comments FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete their own comments" ON token_comments FOR DELETE USING (user_id = auth.uid());

-- Comment likes policies
CREATE POLICY "Anyone can view comment likes" ON comment_likes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can like comments" ON comment_likes FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can remove their own likes" ON comment_likes FOR DELETE USING (user_id = auth.uid());

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for token_comments updated_at
CREATE TRIGGER update_token_comments_updated_at 
  BEFORE UPDATE ON token_comments 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Sample data for testing (optional)
-- INSERT INTO token_comments (token_id, user_id, content) VALUES
-- ('token-uuid-here', 'user-uuid-here', 'Great token! Going to the moon! 🚀'); 