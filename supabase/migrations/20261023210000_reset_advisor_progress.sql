-- Reinicia el progreso de un asesor: puntos, nivel, ventas acumuladas y skin equipada.
-- Las ventas viven con sus clientes (on delete cascade), así que borrar los clientes
-- también reinicia el progreso para que puntos y nivel no queden sin respaldo.
create or replace function public.reset_mvp_advisor_progress(target_advisor uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_count integer;
begin
  if not (select app_private.is_admin()) then
    raise exception 'Solo un administrador puede reiniciar puntos';
  end if;

  update public.mvp_profiles
  set points = 0, level = 1, progression_sales = 0, equipped_skin = 'classic'
  where user_id = target_advisor and role = 'advisor';
  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

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

  perform public.reset_mvp_advisor_progress(target_advisor);
  return deleted_count;
end;
$$;

revoke all on function public.reset_mvp_advisor_progress(uuid) from public, anon;
grant execute on function public.reset_mvp_advisor_progress(uuid) to authenticated;
revoke all on function public.delete_mvp_advisor_clients(uuid) from public, anon;
grant execute on function public.delete_mvp_advisor_clients(uuid) to authenticated;
