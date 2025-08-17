-- supabase/migrations/20240815140000_create_increment_holding_rpc.sql

create or replace function increment_holding(
  p_user_id uuid,
  p_token_id uuid,
  p_amount_to_add bigint -- Amount in lamports (the smallest unit of the token)
)
returns void
language plpgsql
security definer
as $$
begin
  -- This function atomically increments a user's token holding.
  -- It's useful for airdrops, rewards, or administrative adjustments.
  -- It does NOT record a transaction or update financial metrics like average_price.

  insert into public.user_holdings (user_id, token_id, amount)
  values (p_user_id, p_token_id, p_amount_to_add)
  on conflict (user_id, token_id) do update
  set
    amount = user_holdings.amount + excluded.amount,
    updated_at = now();
end;
$$;

-- Grant execute to a specific role, like service_role, for admin actions.
-- Granting to 'authenticated' allows any user to call it, which may not be desired.
grant execute on function public.increment_holding(uuid, uuid, bigint) to service_role;
grant execute on function public.increment_holding(uuid, uuid, bigint) to authenticated; -- Or keep for user-based rewards