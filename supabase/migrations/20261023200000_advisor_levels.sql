-- Siete niveles de progreso por ventas confirmadas acumuladas. La recompensa de cada nivel
-- solo se muestra en la pantalla Progreso: no modifica comisiones ni la cartera.
create table if not exists public.mvp_levels (
  level smallint primary key check (level between 1 and 7),
  name text not null,
  min_confirmed_sales integer not null unique check (min_confirmed_sales >= 0),
  reward_amount numeric(14, 2) not null check (reward_amount > 0)
);

insert into public.mvp_levels (level, name, min_confirmed_sales, reward_amount) values
  (1, 'Bienvenido al equipo', 0, 50000),
  (2, 'Primeros resultados', 1, 100000),
  (3, 'Más clientes, más ventas', 3, 150000),
  (4, 'Construyendo más oportunidades', 5, 200000),
  (5, 'Expansión comercial', 8, 250000),
  (6, 'Líder de tu zona', 12, 400000),
  (7, 'Maestro comercial', 16, 600000)
on conflict (level) do update
set name = excluded.name, min_confirmed_sales = excluded.min_confirmed_sales, reward_amount = excluded.reward_amount;

alter table public.mvp_levels enable row level security;
revoke all on public.mvp_levels from public, anon;
grant select on public.mvp_levels to authenticated;
drop policy if exists "levels_authenticated_read" on public.mvp_levels;
create policy "levels_authenticated_read" on public.mvp_levels
  for select to authenticated using (true);

alter table public.mvp_profiles drop constraint if exists mvp_profiles_level_valid;
alter table public.mvp_profiles add constraint mvp_profiles_level_valid check (level between 1 and 7);

create or replace function public.mvp_level_for_sales(confirmed_sales integer)
returns smallint
language sql
stable
set search_path = ''
as $$
  select coalesce(max(levels.level), 1)::smallint
  from public.mvp_levels levels
  where levels.min_confirmed_sales <= confirmed_sales;
$$;

-- Asesores existentes: el nivel se recalcula con los nuevos umbrales, sin bonos retroactivos.
update public.mvp_profiles
set level = public.mvp_level_for_sales(progression_sales)
where level <> public.mvp_level_for_sales(progression_sales);

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

  current_level := greatest(previous_level, public.mvp_level_for_sales(current_sales));
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

-- Progreso del asesor autenticado: nivel actual, siguiente meta y recompensas.
create or replace function public.get_my_level_progress()
returns table (
  level smallint, name text, confirmed_sales integer, reward_amount numeric,
  next_level smallint, next_name text, next_min_sales integer, next_reward_amount numeric, remaining_sales integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select current_level.level, current_level.name, profiles.progression_sales, current_level.reward_amount,
    next_level.level, next_level.name, next_level.min_confirmed_sales, next_level.reward_amount,
    greatest(next_level.min_confirmed_sales - profiles.progression_sales, 0)
  from public.mvp_profiles profiles
  join public.mvp_levels current_level on current_level.level = profiles.level
  left join public.mvp_levels next_level on next_level.level = profiles.level + 1
  where profiles.user_id = (select auth.uid());
$$;

revoke all on function public.mvp_level_for_sales(integer) from public, anon;
grant execute on function public.mvp_level_for_sales(integer) to authenticated;
revoke all on function public.confirm_mvp_sale(uuid) from public, anon;
grant execute on function public.confirm_mvp_sale(uuid) to authenticated;
revoke all on function public.get_my_level_progress() from public, anon;
grant execute on function public.get_my_level_progress() to authenticated;
