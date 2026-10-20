create table public.mvp_sales (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references public.mvp_clients(id) on delete cascade,
  advisor_id uuid not null references public.mvp_profiles(user_id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  completed_at timestamptz not null default now()
);

create index mvp_sales_advisor_id_idx on public.mvp_sales(advisor_id);

create or replace function public.complete_mvp_task(target_task uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_client uuid;
  completed_count integer;
  total_count integer;
begin
  update public.mvp_tasks as tasks
  set completed_at = now()
  where tasks.id = target_task
    and tasks.completed_at is null
    and exists (
      select 1 from public.mvp_clients as clients
      where clients.id = tasks.client_id
        and clients.advisor_id = (select auth.uid())
    )
  returning client_id into target_client;

  if target_client is null then
    return false;
  end if;

  select count(*) filter (where completed_at is not null), count(*)
  into completed_count, total_count
  from public.mvp_tasks
  where client_id = target_client;

  if completed_count = total_count and total_count = 4 then
    insert into public.mvp_sales (client_id, advisor_id, amount)
    select target_client, clients.advisor_id, floor(random() * 900000 + 100000)::numeric
    from public.mvp_clients as clients
    where clients.id = target_client
    on conflict (client_id) do nothing;
  end if;

  return true;
end;
$$;

alter table public.mvp_sales enable row level security;

create policy "sales_admin_or_owner_read" on public.mvp_sales
for select to authenticated
using ((select app_private.is_admin()) or advisor_id = (select auth.uid()));

revoke all on public.mvp_sales from anon, authenticated;
grant select on public.mvp_sales to authenticated;
revoke all on function public.complete_mvp_task(uuid) from public, anon;
grant execute on function public.complete_mvp_task(uuid) to authenticated;
