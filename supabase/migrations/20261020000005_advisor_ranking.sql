create or replace function public.get_mvp_advisor_ranking()
returns table (
  advisor_id uuid,
  full_name text,
  completed_tasks bigint,
  xp bigint,
  "position" bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    profiles.user_id,
    profiles.full_name,
    count(tasks.id) filter (where tasks.completed_at is not null),
    count(tasks.id) filter (where tasks.completed_at is not null) * 10,
    row_number() over (
      order by
        count(tasks.id) filter (where tasks.completed_at is not null) desc,
        profiles.full_name asc
    )
  from public.mvp_profiles as profiles
  left join public.mvp_clients as clients
    on clients.advisor_id = profiles.user_id
  left join public.mvp_tasks as tasks
    on tasks.client_id = clients.id
  where profiles.role = 'advisor'
    and (select auth.uid()) is not null
  group by profiles.user_id, profiles.full_name
  order by 5;
$$;

revoke all on function public.get_mvp_advisor_ranking() from public, anon;
grant execute on function public.get_mvp_advisor_ranking() to authenticated;
