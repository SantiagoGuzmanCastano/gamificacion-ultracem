create or replace function public.reset_mvp_advisor_tasks(target_advisor uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  if not (select app_private.is_admin()) then
    raise exception 'Solo un administrador puede borrar tareas';
  end if;

  delete from public.mvp_tasks
  where client_id in (
    select id from public.mvp_clients where advisor_id = target_advisor
  );
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.reset_mvp_advisor_tasks(uuid) from public, anon;
grant execute on function public.reset_mvp_advisor_tasks(uuid) to authenticated;
