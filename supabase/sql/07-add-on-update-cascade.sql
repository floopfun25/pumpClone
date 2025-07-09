-- This script updates foreign key constraints to cascade on user ID updates.
-- This is crucial for the user migration logic where an existing public.users record
-- needs to be associated with a new auth.users record.

-- To make this script re-runnable, we check if the constraint exists before dropping.
-- Note: Constraint names can be found in the Supabase dashboard under Database > Tables.
-- If they differ, update them here.

-- Helper function to drop constraint if it exists
CREATE OR REPLACE FUNCTION drop_constraint_if_exists(
    p_table_name TEXT,
    p_constraint_name TEXT
)
RETURNS VOID AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_name = p_table_name
          AND constraint_name = p_constraint_name
          AND constraint_type = 'FOREIGN KEY'
    ) THEN
        EXECUTE 'ALTER TABLE public.' || quote_ident(p_table_name) ||
                ' DROP CONSTRAINT ' || quote_ident(p_constraint_name);
    END IF;
END;
$$ LANGUAGE plpgsql;


-- Update constraints for tables referencing users.id

-- 1. tokens table
SELECT drop_constraint_if_exists('tokens', 'tokens_creator_id_fkey');
ALTER TABLE public.tokens
  ADD CONSTRAINT tokens_creator_id_fkey
  FOREIGN KEY (creator_id) REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- 2. transactions table
SELECT drop_constraint_if_exists('transactions', 'transactions_user_id_fkey');
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. user_holdings table
SELECT drop_constraint_if_exists('user_holdings', 'user_holdings_user_id_fkey');
ALTER TABLE public.user_holdings
  ADD CONSTRAINT user_holdings_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. token_comments table
SELECT drop_constraint_if_exists('token_comments', 'token_comments_user_id_fkey');
ALTER TABLE public.token_comments
  ADD CONSTRAINT token_comments_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. comment_likes table
SELECT drop_constraint_if_exists('comment_likes', 'comment_likes_user_id_fkey');
ALTER TABLE public.comment_likes
  ADD CONSTRAINT comment_likes_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- 6. conversations table (user1_id)
SELECT drop_constraint_if_exists('conversations', 'conversations_user1_id_fkey');
ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_user1_id_fkey
  FOREIGN KEY (user1_id) REFERENCES public.users(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- 7. conversations table (user2_id)
SELECT drop_constraint_if_exists('conversations', 'conversations_user2_id_fkey');
ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_user2_id_fkey
  FOREIGN KEY (user2_id) REFERENCES public.users(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- 8. messages table (sender_id)
SELECT drop_constraint_if_exists('messages', 'messages_sender_id_fkey');
ALTER TABLE public.messages
  ADD CONSTRAINT messages_sender_id_fkey
  FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- 9. messages table (receiver_id)
SELECT drop_constraint_if_exists('messages', 'messages_receiver_id_fkey');
ALTER TABLE public.messages
  ADD CONSTRAINT messages_receiver_id_fkey
  FOREIGN KEY (receiver_id) REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- Clean up helper function
DROP FUNCTION drop_constraint_if_exists(TEXT, TEXT);

-- Note: ON DELETE behavior is set based on logical assumptions:
-- - SET NULL for creator/sender IDs to preserve records if a user is deleted.
-- - CASCADE for holdings/likes/comments which are user-specific and should be cleaned up. 