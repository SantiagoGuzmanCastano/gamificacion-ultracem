create or replace function public.complete_mvp_task(target_task uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare changed integer;
begin
  update public.mvp_tasks tasks set completed_at = now()
  where tasks.id = target_task and tasks.completed_at is null
    and exists (select 1 from public.mvp_clients clients where clients.id = tasks.client_id and clients.advisor_id = (select auth.uid()));
  get diagnostics changed = row_count;
  return changed > 0;
end;
$$;

create or replace function public.confirm_mvp_sale(target_client uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare advisor uuid; sale_id uuid;
begin
  select clients.advisor_id into advisor from public.mvp_clients clients where clients.id = target_client;
  if advisor is null or advisor <> (select auth.uid()) then raise exception 'Client is not assigned to this advisor'; end if;
  if (select count(*) from public.mvp_tasks where client_id = target_client and completed_at is not null) <> 4 then raise exception 'All four tasks must be completed'; end if;
  insert into public.mvp_sales (client_id, advisor_id, amount)
  values (target_client, advisor, floor(random() * 900000 + 100000)::numeric)
  on conflict (client_id) do nothing returning id into sale_id;
  if sale_id is null then raise exception 'Sale is already confirmed'; end if;
  return sale_id;
end;
$$;

drop function if exists public.get_mvp_advisor_ranking();

create function public.get_mvp_advisor_ranking()
returns table (advisor_id uuid, full_name text, completed_tasks bigint, xp bigint, confirmed_sales bigint, "position" bigint)
language sql stable security definer set search_path = ''
as $$
  select profiles.user_id, profiles.full_name,
    count(distinct tasks.id) filter (where tasks.completed_at is not null),
    count(distinct tasks.id) filter (where tasks.completed_at is not null) * 10,
    count(distinct sales.id),
    row_number() over (order by count(distinct sales.id) desc, count(distinct tasks.id) filter (where tasks.completed_at is not null) * 10 desc, profiles.full_name asc)
  from public.mvp_profiles profiles
  left join public.mvp_clients clients on clients.advisor_id = profiles.user_id
  left join public.mvp_tasks tasks on tasks.client_id = clients.id
  left join public.mvp_sales sales on sales.advisor_id = profiles.user_id
  where profiles.role = 'advisor' and (select auth.uid()) is not null
  group by profiles.user_id, profiles.full_name order by 6;
$$;

revoke all on function public.get_mvp_advisor_ranking() from public, anon;
grant execute on function public.get_mvp_advisor_ranking() to authenticated;

create or replace function public.equip_mvp_skin(target_skin text)
returns text language plpgsql security definer set search_path = ''
as $$
declare confirmed_sales bigint;
begin
  if (select role from public.mvp_profiles where user_id = (select auth.uid())) <> 'advisor' then raise exception 'Only advisors can equip skins'; end if;
  if target_skin = 'classic' then update public.mvp_profiles set equipped_skin = 'classic' where user_id = (select auth.uid()); return 'classic'; end if;
  if target_skin <> 'skeleton' then raise exception 'Skin is not available'; end if;
  if not coalesce((select halloween_enabled from public.mvp_app_settings where id = true), false) then raise exception 'Halloween mode is not active'; end if;
  select count(*) into confirmed_sales from public.mvp_sales where advisor_id = (select auth.uid()) and confirmed;
  if confirmed_sales < 1 then raise exception 'Not enough confirmed sales to equip this skin'; end if;
  update public.mvp_profiles set equipped_skin = 'skeleton' where user_id = (select auth.uid());
  return 'skeleton';
end;
$$;

revoke update (completed_at) on public.mvp_tasks from authenticated;
revoke all on function public.confirm_mvp_sale(uuid) from public, anon;
grant execute on function public.confirm_mvp_sale(uuid) to authenticated;
