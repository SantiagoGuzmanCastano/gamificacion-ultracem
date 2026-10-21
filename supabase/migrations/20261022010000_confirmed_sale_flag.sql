alter table public.mvp_sales
  add column confirmed boolean not null default false;

create or replace function public.confirm_mvp_sale(target_client uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare advisor uuid; sale_id uuid;
begin
  select clients.advisor_id into advisor from public.mvp_clients clients where clients.id = target_client;
  if advisor is null or advisor <> (select auth.uid()) then raise exception 'Client is not assigned to this advisor'; end if;
  if (select count(*) from public.mvp_tasks where client_id = target_client and completed_at is not null) <> 4 then raise exception 'All four tasks must be completed'; end if;
  update public.mvp_sales set confirmed = true
  where client_id = target_client and advisor_id = advisor and not confirmed
  returning id into sale_id;
  if sale_id is null then
    insert into public.mvp_sales (client_id, advisor_id, amount, confirmed)
    values (target_client, advisor, floor(random() * 900000 + 100000)::numeric, true)
    on conflict (client_id) do nothing returning id into sale_id;
  end if;
  if sale_id is null then raise exception 'Sale is already confirmed'; end if;
  return sale_id;
end;
$$;

create or replace function public.get_mvp_advisor_ranking()
returns table (advisor_id uuid, full_name text, completed_tasks bigint, xp bigint, confirmed_sales bigint, "position" bigint)
language sql stable security definer set search_path = ''
as $$
  select profiles.user_id, profiles.full_name,
    count(distinct tasks.id) filter (where tasks.completed_at is not null),
    count(distinct tasks.id) filter (where tasks.completed_at is not null) * 10,
    count(distinct sales.id) filter (where sales.confirmed),
    row_number() over (order by count(distinct sales.id) filter (where sales.confirmed) desc, count(distinct tasks.id) filter (where tasks.completed_at is not null) * 10 desc, profiles.full_name asc)
  from public.mvp_profiles profiles
  left join public.mvp_clients clients on clients.advisor_id = profiles.user_id
  left join public.mvp_tasks tasks on tasks.client_id = clients.id
  left join public.mvp_sales sales on sales.advisor_id = profiles.user_id
  where profiles.role = 'advisor' and (select auth.uid()) is not null
  group by profiles.user_id, profiles.full_name order by 6;
$$;
