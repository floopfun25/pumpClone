-- supabase/sql/06-rls-helper-functions.sql

-- A security invoker function to reliably get the current user's ID.
-- RLS policies can sometimes have issues with auth.uid() in complex scenarios.
-- This function ensures we are always getting the uid of the user making the request.
CREATE OR REPLACE FUNCTION public.get_my_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY INVOKER -- This is the key part! It runs as the user who calls it.
AS $$
  SELECT auth.uid();
$$;

-- Grant permission for any authenticated user to call this function.
GRANT EXECUTE ON FUNCTION public.get_my_user_id() TO authenticated; 