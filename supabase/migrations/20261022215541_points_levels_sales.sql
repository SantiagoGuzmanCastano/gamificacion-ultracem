alter table public.mvp_profiles
  add column if not exists points integer not null default 0,
  add column if not exists level smallint not null default 1,
  add column if not exists progression_sales integer not null default 0;

alter table public.mvp_profiles
  add constraint mvp_profiles_points_nonnegative check (points >= 0),
  add constraint mvp_profiles_level_valid check (level between 1 and 3),
  add constraint mvp_profiles_progression_sales_nonnegative check (progression_sales >= 0);

create or replace function public.complete_mvp_task(target_task uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_client uuid;
  advisor uuid;
begin
  update public.mvp_tasks as tasks
  set completed_at = now()
  where tasks.id = target_task
    and tasks.completed_at is null
    and exists (
      select 1
      from public.mvp_clients as clients
      where clients.id = tasks.client_id
        and clients.advisor_id = (select auth.uid())
    )
  returning client_id into target_client;

  if target_client is null then
    return false;
  end if;

  select clients.advisor_id into advisor
  from public.mvp_clients as clients
  where clients.id = target_client;

  update public.mvp_profiles
  set points = points + 5
  where user_id = advisor;

  return true;
end;
$$;

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

  update public.mvp_sales
  set confirmed = true, tons_sold = requested_tons, confirmed_at = now()
  where client_id = target_client and advisor_id = advisor and not confirmed
  returning id into sale_id;

  if sale_id is null then
    insert into public.mvp_sales (client_id, advisor_id, amount, confirmed, tons_sold, confirmed_at)
    values (target_client, advisor, floor(random() * 900000 + 100000)::numeric, true, requested_tons, now())
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

drop function if exists public.get_mvp_advisor_ranking();
create function public.get_mvp_advisor_ranking()
returns table (advisor_id uuid, full_name text, completed_tasks bigint, points integer, confirmed_sales bigint, confirmed_tons numeric, "position" bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select profiles.user_id, profiles.full_name,
    count(distinct tasks.id) filter (where tasks.completed_at is not null),
    profiles.points,
    (select count(*) from public.mvp_sales own_sales where own_sales.advisor_id = profiles.user_id and own_sales.confirmed),
    (select coalesce(sum(own_sales.tons_sold), 0) from public.mvp_sales own_sales where own_sales.advisor_id = profiles.user_id and own_sales.confirmed),
    row_number() over (
      order by
        (select count(*) from public.mvp_sales own_sales where own_sales.advisor_id = profiles.user_id and own_sales.confirmed) desc,
        profiles.points desc,
        profiles.full_name asc
    )
  from public.mvp_profiles profiles
  left join public.mvp_clients clients on clients.advisor_id = profiles.user_id
  left join public.mvp_tasks tasks on tasks.client_id = clients.id
  where profiles.role = 'advisor' and (select auth.uid()) is not null
  group by profiles.user_id, profiles.full_name, profiles.points
  order by 7;
$$;

revoke all on function public.complete_mvp_task(uuid) from public, anon;
grant execute on function public.complete_mvp_task(uuid) to authenticated;
revoke all on function public.confirm_mvp_sale(uuid) from public, anon;
grant execute on function public.confirm_mvp_sale(uuid) to authenticated;
revoke all on function public.get_mvp_advisor_ranking() from public, anon;
grant execute on function public.get_mvp_advisor_ranking() to authenticated;
