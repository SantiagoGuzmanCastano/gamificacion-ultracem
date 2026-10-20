create or replace function public.delete_mvp_advisor_clients(target_advisor uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  if not (select app_private.is_admin()) then
    raise exception 'Solo un administrador puede borrar clientes';
  end if;

  delete from public.mvp_clients
  where advisor_id = target_advisor;
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.delete_mvp_advisor_clients(uuid) from public, anon;
grant execute on function public.delete_mvp_advisor_clients(uuid) to authenticated;
