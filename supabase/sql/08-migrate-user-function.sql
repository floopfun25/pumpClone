-- Creates a trigger function that automatically copies new users from auth.users to public.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Only insert if wallet_address doesn't already exist
  IF NEW.raw_user_meta_data->>'wallet_address' IS NOT NULL 
     AND NOT EXISTS (
       SELECT 1 FROM public.users 
       WHERE wallet_address = NEW.raw_user_meta_data->>'wallet_address'
     ) THEN
    INSERT INTO public.users (id, wallet_address, username)
    VALUES (
      NEW.id,
      NEW.raw_user_meta_data->>'wallet_address',
      NEW.raw_user_meta_data->>'username'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Creates a trigger that fires after a new user is inserted into auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- A function to migrate existing users from auth.users to public.users
CREATE OR REPLACE FUNCTION public.migrate_users()
RETURNS boolean AS $$
BEGIN
  -- Copy data from auth.users to public.users
  INSERT INTO public.users (id, wallet_address, username)
  SELECT id, raw_user_meta_data->>'wallet_address', raw_user_meta_data->>'username'
  FROM auth.users;

  -- Indicate that the migration was successful
  RAISE NOTICE 'User migration completed successfully.';
  
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    -- If any error occurs, log it and return false
    RAISE WARNING 'An error occurred during user migration: %', SQLERRM;
    RETURN false;
END;
$$ LANGUAGE plpgsql;

-- A function to migrate a single user, used for fixing corrupted user entries
CREATE OR REPLACE FUNCTION public.migrate_single_user(
    old_user_id_param uuid,
    new_user_id_param uuid
)
RETURNS boolean AS $$
DECLARE
    old_wallet_address_val TEXT;
    old_username_val TEXT;
    current_user_id uuid;
BEGIN
    -- Security check: Only allow authorized users to perform migration
    current_user_id := auth.uid();
    
    -- Allow service role to perform any migration
    IF auth.role() = 'service_role' THEN
        -- Service role can proceed without additional checks
        NULL;
    -- For regular users, they can only migrate their own data
    ELSIF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required for user migration';
    ELSIF current_user_id != old_user_id_param AND current_user_id != new_user_id_param THEN
        RAISE EXCEPTION 'Unauthorized: You can only migrate your own user data';
    END IF;

    -- Step 1: Get wallet_address and username from old user entry
    SELECT wallet_address, username INTO old_wallet_address_val, old_username_val
    FROM public.users
    WHERE id = old_user_id_param;

    -- Step 2: Update new user entry with old wallet_address and username
    UPDATE public.users
    SET
        wallet_address = old_wallet_address_val,
        username = old_username_val
    WHERE id = new_user_id_param;

    -- Step 3: Update foreign key references in other tables
    -- Update all tables that reference user_id
    UPDATE public.tokens SET creator_id = new_user_id_param WHERE creator_id = old_user_id_param;
    UPDATE public.user_holdings SET user_id = new_user_id_param WHERE user_id = old_user_id_param;
    UPDATE public.token_comments SET user_id = new_user_id_param WHERE user_id = old_user_id_param;
    UPDATE public.comment_likes SET user_id = new_user_id_param WHERE user_id = old_user_id_param;
    UPDATE public.transactions SET user_id = new_user_id_param WHERE user_id = old_user_id_param;
    UPDATE public.conversations SET user1_id = new_user_id_param WHERE user1_id = old_user_id_param;
    UPDATE public.conversations SET user2_id = new_user_id_param WHERE user2_id = old_user_id_param;
    UPDATE public.messages SET sender_id = new_user_id_param WHERE sender_id = old_user_id_param;
    UPDATE public.messages SET receiver_id = new_user_id_param WHERE receiver_id = old_user_id_param;
    -- Update watchlist if it exists
    UPDATE public.user_watchlist SET user_id = new_user_id_param WHERE user_id = old_user_id_param;
    -- Note: RLS policies should handle security, but this ensures data integrity.
    
    -- Step 4: Delete the old user entry
    DELETE FROM public.users WHERE id = old_user_id_param;
    
    -- After successful migration, it's safe to remove the old entry from auth.users as well.
    -- Be cautious with this step and ensure you have backups.
    DELETE FROM auth.users WHERE id = old_user_id_param;

    RAISE NOTICE 'Successfully migrated user % to %', old_user_id_param, new_user_id_param;
    RETURN true;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'An error occurred during single user migration: %', SQLERRM;
        RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 