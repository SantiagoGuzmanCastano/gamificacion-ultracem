drop function if exists public.get_mvp_advisor_ranking();
create function public.get_mvp_advisor_ranking()
returns table (advisor_id uuid, full_name text, completed_tasks bigint, xp bigint, confirmed_sales bigint, confirmed_tons numeric, "position" bigint)
language sql stable security definer set search_path = ''
as $$
  select profiles.user_id, profiles.full_name,
    count(distinct tasks.id) filter (where tasks.completed_at is not null),
    count(distinct tasks.id) filter (where tasks.completed_at is not null) * 10,
    (select count(*) from public.mvp_sales own_sales where own_sales.advisor_id = profiles.user_id and own_sales.confirmed),
    (select coalesce(sum(own_sales.tons_sold), 0) from public.mvp_sales own_sales where own_sales.advisor_id = profiles.user_id and own_sales.confirmed),
    row_number() over (
      order by
        (select count(*) from public.mvp_sales own_sales where own_sales.advisor_id = profiles.user_id and own_sales.confirmed) desc,
        count(distinct tasks.id) filter (where tasks.completed_at is not null) * 10 desc,
        profiles.full_name asc
    )
  from public.mvp_profiles profiles
  left join public.mvp_clients clients on clients.advisor_id = profiles.user_id
  left join public.mvp_tasks tasks on tasks.client_id = clients.id
  where profiles.role = 'advisor' and (select auth.uid()) is not null
  group by profiles.user_id, profiles.full_name order by 7;
$$;

revoke all on function public.get_mvp_advisor_ranking() from public, anon;
grant execute on function public.get_mvp_advisor_ranking() to authenticated;
