create or replace function public.reset_mvp_advisor_tasks(target_advisor uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  client_ids uuid[];
  deleted_count integer;
begin
  if not (select app_private.is_admin()) then
    raise exception 'Solo un administrador puede reiniciar tareas';
  end if;

  select coalesce(array_agg(id), array[]::uuid[])
  into client_ids
  from public.mvp_clients
  where advisor_id = target_advisor;

  delete from public.mvp_tasks
  where client_id = any(client_ids);
  get diagnostics deleted_count = row_count;

  insert into public.mvp_tasks (client_id, title, description)
  select clients.id, tasks.title, tasks.description
  from unnest(client_ids) as clients(id)
  cross join (
    values
      ('Preparar una visita', 'Define el objetivo de una visita comercial.'),
      ('Contactar al cliente', 'Registra una llamada de seguimiento.'),
      ('Revisar una cotización', 'Confirma si una cotización sigue vigente.'),
      ('Planear el siguiente paso', 'Define la próxima acción para este cliente.')
  ) as tasks(title, description);

  return deleted_count;
end;
$$;

revoke all on function public.reset_mvp_advisor_tasks(uuid) from public, anon;
grant execute on function public.reset_mvp_advisor_tasks(uuid) to authenticated;
