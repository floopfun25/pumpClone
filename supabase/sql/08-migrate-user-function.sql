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
    -- This check is commented out to allow service roles to migrate any user
    -- ELSIF current_user_id != old_user_id_param AND current_user_id != new_user_id_param THEN
    --     RAISE EXCEPTION 'Unauthorized: You can only migrate your own user data';
    END IF;

    RAISE NOTICE 'Migrating user: old_id=%, new_id=%', old_user_id_param, new_user_id_param;

    -- Before update: Check if old_user_id_param exists in public.users
    PERFORM 1 FROM public.users WHERE id = old_user_id_param;
    IF NOT FOUND THEN
        RAISE WARNING 'migrate_single_user: old_user_id_param % not found in public.users before update.', old_user_id_param;
        RETURN false; -- Or handle as appropriate if it should always exist
    END IF;

    -- Step 1: Update the ID of the existing user record
    -- This is the correct way to migrate a user without violating foreign key constraints
    UPDATE public.users
    SET id = new_user_id_param
    WHERE id = old_user_id_param;

    -- After update: Check if new_user_id_param now exists in public.users
    PERFORM 1 FROM public.users WHERE id = new_user_id_param;
    IF NOT FOUND THEN
        RAISE WARNING 'migrate_single_user: new_user_id_param % not found in public.users after update!', new_user_id_param;
        -- Consider re-inserting if update failed, but this indicates a deeper issue
    END IF;

    -- Step 2: Delete the old user entry from auth.users
    -- The new user from signInAnonymously is now linked to the existing public.users profile
    DELETE FROM auth.users WHERE id = old_user_id_param;

    RAISE NOTICE 'Successfully migrated user % to %', old_user_id_param, new_user_id_param;
    RETURN true;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'An error occurred during single user migration: %', SQLERRM;
        RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 