create or replace function public.clear_mvp_completed_tasks(target_client uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  completed_count integer;
  total_count integer;
  deleted_count integer;
begin
  select count(*) filter (where tasks.completed_at is not null), count(*)
  into completed_count, total_count
  from public.mvp_tasks as tasks
  join public.mvp_clients as clients on clients.id = tasks.client_id
  where tasks.client_id = target_client
    and clients.advisor_id = (select auth.uid());

  if total_count <> 4 or completed_count <> 4 then
    raise exception 'Solo se pueden limpiar tareas cuando la misión está completa';
  end if;

  delete from public.mvp_tasks
  where client_id = target_client and completed_at is not null;
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.clear_mvp_completed_tasks(uuid) from public, anon;
grant execute on function public.clear_mvp_completed_tasks(uuid) to authenticated;
