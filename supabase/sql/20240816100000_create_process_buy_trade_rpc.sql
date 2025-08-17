-- supabase/migrations/20240816100000_create_process_buy_trade_rpc.sql

create or replace function process_buy_trade(
  p_user_id uuid,
  p_token_id uuid,
  p_signature text,
  p_sol_amount numeric,
  p_token_amount numeric,
  p_new_price numeric,
  p_new_market_cap numeric
)
returns void
language plpgsql
security definer
as $$
declare
  v_token_amount_lamports bigint;
begin
  -- Convert token amount to lamports (assuming 9 decimals)
  v_token_amount_lamports := (p_token_amount * 1e9)::bigint;

  -- Record the transaction
  insert into public.transactions (signature, token_id, user_id, transaction_type, sol_amount, token_amount, price_per_token, status, block_time)
  values (p_signature, p_token_id, p_user_id, 'buy', p_sol_amount, p_token_amount, p_new_price, 'completed', now());

  -- Update token statistics
  update public.tokens set
    current_price = p_new_price,
    market_cap = p_new_market_cap,
    volume_24h = volume_24h + p_sol_amount,
    last_trade_at = now()
  where id = p_token_id;

  -- Atomically increment the user's holding or create a new one if it doesn't exist.
  insert into public.user_holdings (user_id, token_id, amount, total_invested, average_price)
  values (p_user_id, p_token_id, v_token_amount_lamports, p_sol_amount, p_new_price)
  on conflict (user_id, token_id) do update
  set
    amount = user_holdings.amount + excluded.amount,
    total_invested = user_holdings.total_invested + excluded.total_invested,
    -- Recalculate average price: (total SOL invested) / (total tokens held)
    average_price = (user_holdings.total_invested + excluded.total_invested) / ((user_holdings.amount + excluded.amount) / 1e9),
    updated_at = now();
end;
$$;

grant execute on function public.process_buy_trade(uuid, uuid, text, numeric, numeric, numeric, numeric) to authenticated;