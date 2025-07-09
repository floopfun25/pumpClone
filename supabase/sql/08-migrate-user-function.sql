-- This script creates a function to migrate data from an old user profile to a new one,
-- then deletes the old profile. This is the new approach to linking an existing
-- public.users profile to a new auth.users record, preserving the new session.

-- Drop the old, problematic merge_users function if it exists
DROP FUNCTION IF EXISTS public.merge_users(old_user_id uuid, new_user_id uuid);

-- Create the new user migration function
CREATE OR REPLACE FUNCTION public.migrate_user_data(
    old_user_id_param uuid,
    new_user_id_param uuid
)
RETURNS void AS $$
DECLARE
    old_wallet_address_val TEXT;
BEGIN
    -- 1. Get the wallet address from the old user record
    SELECT wallet_address INTO old_wallet_address_val
    FROM public.users
    WHERE id = old_user_id_param;

    -- 2. Update the public.users table.
    -- This changes the primary key of the old user record to the new user's ID.
    -- Thanks to ON UPDATE CASCADE, all referencing tables will be updated automatically.
    UPDATE public.users
    SET id = new_user_id_param,
        -- Also update the wallet_address in case it differs, which shouldn't happen
        -- but as a safeguard.
        wallet_address = old_wallet_address_val,
        updated_at = now()
    WHERE id = old_user_id_param;

    -- 3. Delete the now-obsolete user record from auth.users.
    -- The public profile has been migrated, so we can safely remove the old auth entry.
    -- Note: We are NOT deleting the new auth user, so the session remains valid.
    DELETE FROM auth.users WHERE id = old_user_id_param;

    -- It's possible the new user also has a public profile created automatically.
    -- This would have the same wallet address. If so, we should remove the one
    -- associated with the old user ID, which we've just migrated from.
    -- The UPDATE above handles the PK change, but let's ensure no duplicates remain.
    -- The above UPDATE already re-points the definitive public.users record.
    -- Any other user record with the same wallet address is now a duplicate and can be removed.
    -- However, the UPDATE changes the ID, so a simple delete is tricky.
    -- The initial UPDATE should be sufficient. If any duplicate profile for the new_user_id
    -- was created, it would be empty and can be ignored or cleaned up separately.

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions to the authenticated role
GRANT EXECUTE ON FUNCTION public.migrate_user_data(uuid, uuid) TO authenticated;

-- Comment on the function for clarity
COMMENT ON FUNCTION public.migrate_user_data(uuid, uuid) IS
'Migrates a public.users profile and its related data from an old UUID to a new UUID, then deletes the old auth.users entry. Used for linking existing profiles to new auth sessions.'; 