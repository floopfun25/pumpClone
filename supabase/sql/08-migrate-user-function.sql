-- Creates a trigger function that automatically copies new users from auth.users to public.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, wallet_address, username)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'wallet_address',
    NEW.raw_user_meta_data->>'username'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Creates a trigger that fires after a new user is inserted into auth.users
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
BEGIN
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
    -- Add more UPDATE statements here for each table that references user_id
    UPDATE public.tokens SET creator_id = new_user_id_param WHERE creator_id = old_user_id_param;
    UPDATE public.user_holdings SET user_id = new_user_id_param WHERE user_id = old_user_id_param;
    UPDATE public.comments SET user_id = new_user_id_param WHERE user_id = old_user_id_param;
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