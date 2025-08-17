-- supabase/migrations/YYYYMMDDHHMMSS_create_process_sell_trade_rpc.sql

create or replace function process_sell_trade(
  p_user_id uuid,
  p_token_id uuid,
  p_signature text,
  p_sol_received numeric, -- Use numeric for monetary values
  p_tokens_sold numeric,  -- Use numeric for token amounts that can be fractional
  p_new_price numeric,
  p_new_market_cap numeric
)
returns void
language plpgsql
security definer
as $$
declare
  v_tokens_sold_lamports bigint;
  v_new_holding_lamports bigint;
begin
  -- Note: The user_holdings.amount is stored as lamports (bigint).
  -- The input p_tokens_sold is a decimal representation.
  -- We convert it to lamports for the update.
  -- This assumes a fixed 9 decimals. Consider making this dynamic if tokens can have different decimals.
  v_tokens_sold_lamports := (p_tokens_sold * 1e9)::bigint;

  -- Record the transaction
  insert into public.transactions (signature, token_id, user_id, transaction_type, sol_amount, token_amount, price_per_token, status, block_time)
  values (p_signature, p_token_id, p_user_id, 'sell', p_sol_received, p_tokens_sold, p_new_price, 'completed', now());

  -- Update token statistics
  update public.tokens set
    current_price = p_new_price,
    market_cap = p_new_market_cap, -- Assuming market_cap is numeric or bigint
    volume_24h = volume_24h + p_sol_received, -- Assuming volume_24h is numeric or bigint
    last_trade_at = now()
  where id = p_token_id;

  -- Atomically decrement the user's holding.
  -- This is safer than a separate SELECT and UPDATE.
  update public.user_holdings
  set
    amount = amount - v_tokens_sold_lamports, -- Direct arithmetic on bigint
    updated_at = now()
  where user_id = p_user_id and token_id = p_token_id
  returning amount into v_new_holding_lamports;

  -- Clean up by removing the holding if the balance is zero or less.
  if v_new_holding_lamports <= 0 then
    delete from public.user_holdings
    where user_id = p_user_id and token_id = p_token_id;
  end if;  
end;
$$;

grant execute on function public.process_sell_trade(uuid, uuid, text, numeric, numeric, numeric, numeric) to authenticated;