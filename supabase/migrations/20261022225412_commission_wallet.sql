alter table public.mvp_app_settings
  add column if not exists commission_price_per_ton numeric(12, 2) not null default 800000,
  add column if not exists commission_rate numeric(5, 4) not null default 0.03,
  add constraint mvp_app_settings_commission_price_positive check (commission_price_per_ton > 0),
  add constraint mvp_app_settings_commission_rate_valid check (commission_rate > 0 and commission_rate <= 1);

alter table public.mvp_sales
  add column if not exists commission_price_per_ton numeric(12, 2) check (commission_price_per_ton > 0),
  add column if not exists commission_rate numeric(5, 4) check (commission_rate > 0 and commission_rate <= 1),
  add column if not exists commission_amount numeric(14, 2) check (commission_amount > 0),
  add column if not exists commission_status text check (commission_status in ('available', 'pending', 'paid')),
  add column if not exists commission_claimed_at timestamptz;

create index if not exists mvp_sales_advisor_commission_idx
  on public.mvp_sales (advisor_id, commission_status)
  where confirmed and commission_amount is not null;

create or replace function public.confirm_mvp_sale(target_client uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  advisor uuid;
  sale_id uuid;
  requested_tons numeric;
  previous_level smallint;
  current_sales integer;
  current_level smallint;
  level_bonus integer := 0;
  price_per_ton numeric(12, 2);
  rate numeric(5, 4);
  commission numeric(14, 2);
begin
  select clients.advisor_id, clients.tons_requested
  into advisor, requested_tons
  from public.mvp_clients clients
  where clients.id = target_client;

  if advisor is null or advisor <> (select auth.uid()) then
    raise exception 'Client is not assigned to this advisor';
  end if;
  if requested_tons is null or requested_tons <= 0 then
    raise exception 'Client has no valid tons value';
  end if;
  if (select count(*) from public.mvp_tasks where client_id = target_client and completed_at is not null) <> 4 then
    raise exception 'All four tasks must be completed';
  end if;

  select settings.commission_price_per_ton, settings.commission_rate
  into price_per_ton, rate
  from public.mvp_app_settings settings
  where settings.id;

  if price_per_ton is null or rate is null then
    raise exception 'Commission settings are unavailable';
  end if;
  commission := round(requested_tons * price_per_ton * rate, 2);

  update public.mvp_sales
  set confirmed = true,
      tons_sold = requested_tons,
      confirmed_at = now(),
      commission_price_per_ton = price_per_ton,
      commission_rate = rate,
      commission_amount = commission,
      commission_status = 'available',
      commission_claimed_at = null
  where client_id = target_client and advisor_id = advisor and not confirmed
  returning id into sale_id;

  if sale_id is null then
    insert into public.mvp_sales (
      client_id, advisor_id, amount, confirmed, tons_sold, confirmed_at,
      commission_price_per_ton, commission_rate, commission_amount, commission_status
    )
    values (
      target_client, advisor, floor(random() * 900000 + 100000)::numeric, true, requested_tons, now(),
      price_per_ton, rate, commission, 'available'
    )
    on conflict (client_id) do nothing
    returning id into sale_id;
  end if;

  if sale_id is null then
    raise exception 'Sale is already confirmed';
  end if;

  select profiles.level into previous_level
  from public.mvp_profiles profiles
  where profiles.user_id = advisor
  for update;

  update public.mvp_profiles
  set progression_sales = progression_sales + 1
  where user_id = advisor
  returning progression_sales into current_sales;

  current_level := case
    when current_sales >= 5 then 3
    when current_sales >= 1 then 2
    else 1
  end;
  if current_level > previous_level then
    level_bonus := 25;
  end if;

  update public.mvp_profiles
  set points = points + 100 + level_bonus,
      level = current_level
  where user_id = advisor;

  return sale_id;
end;
$$;

create function public.request_mvp_commission(target_sale uuid)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  amount numeric(14, 2);
begin
  update public.mvp_sales
  set commission_status = 'pending', commission_claimed_at = now()
  where id = target_sale
    and advisor_id = (select auth.uid())
    and confirmed
    and commission_status = 'available'
    and commission_amount is not null
  returning commission_amount into amount;

  if amount is null then
    raise exception 'Commission is not available';
  end if;

  return amount;
end;
$$;

revoke all on function public.confirm_mvp_sale(uuid) from public, anon;
grant execute on function public.confirm_mvp_sale(uuid) to authenticated;
revoke all on function public.request_mvp_commission(uuid) from public, anon;
grant execute on function public.request_mvp_commission(uuid) to authenticated;
