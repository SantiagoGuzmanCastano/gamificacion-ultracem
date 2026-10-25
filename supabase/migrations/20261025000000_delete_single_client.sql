-- Borra un solo cliente (con sus tareas y su venta, que caen en cascada). Para que puntos y
-- nivel no queden sin respaldo, al asesor se le restan los 5 puntos de cada tarea completada
-- y, si la venta estaba confirmada, los 100 puntos base y una venta acumulada; el nivel se
-- recalcula con mvp_levels. Los bonos de nivel ya entregados no se descuentan.
create or replace function public.delete_mvp_client(target_client uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid;
  done_tasks integer;
  sold boolean;
begin
  if not (select app_private.is_admin()) then
    raise exception 'Solo un administrador puede borrar clientes';
  end if;

  select advisor_id into owner from public.mvp_clients where id = target_client;
  if owner is null then
    return false;
  end if;

  select count(*) into done_tasks from public.mvp_tasks where client_id = target_client and completed_at is not null;
  select coalesce(bool_or(confirmed), false) into sold from public.mvp_sales where client_id = target_client;

  delete from public.mvp_clients where id = target_client;

  update public.mvp_profiles
  set points = greatest(0, points - done_tasks * 5 - case when sold then 100 else 0 end),
      progression_sales = greatest(0, progression_sales - case when sold then 1 else 0 end),
      level = public.mvp_level_for_sales(greatest(0, progression_sales - case when sold then 1 else 0 end))
  where user_id = owner and role = 'advisor';

  return true;
end;
$$;

revoke all on function public.delete_mvp_client(uuid) from public, anon;
grant execute on function public.delete_mvp_client(uuid) to authenticated;
