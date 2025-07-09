-- Supabase SQL function to merge a new anonymous user into an existing user profile.
-- This is crucial for maintaining a stable user ID when a user logs in on a new device.

create or replace function merge_users(old_user_id uuid, new_user_id uuid)
returns void
language plpgsql
security definer
set search_path = auth, public
as $$
begin
  -- Update any references in the public.users table from the new_user_id to the old_user_id.
  -- This shouldn't happen if the logic is correct, but it's a good safeguard.
  update public.users
  set id = old_user_id
  where id = new_user_id;

  -- Here you would add any other table that references `auth.users.id`
  -- For example, if you have a `posts` table:
  -- update public.posts
  -- set user_id = old_user_id
  -- where user_id = new_user_id;

  -- Finally, delete the new (now redundant) user from the auth.users table.
  -- The old user's authentication and data are preserved.
  delete from auth.users where id = new_user_id;
end;
$$;

-- Grant execute permission to the 'authenticated' role so that logged-in users can call this function.
grant execute on function public.merge_users(uuid, uuid) to authenticated;

-- Grant execute permission to the 'service_role' for backend operations if needed.
grant execute on function public.merge_users(uuid, uuid) to service_role; 