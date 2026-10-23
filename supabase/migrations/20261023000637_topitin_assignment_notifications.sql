create or replace function public.assign_mvp_client(
  client_name text,
  client_type text,
  target_advisor uuid,
  target_department text,
  target_city text,
  requested_tons numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  client_id uuid;
  notification_id uuid;
  admin_name text;
  advisor_name text;
begin
  if not (select app_private.is_admin()) then
    raise exception 'Solo un administrador puede asignar clientes';
  end if;
  if not (select app_private.is_advisor(target_advisor)) then
    raise exception 'El asesor seleccionado no es válido';
  end if;
  if requested_tons is null or requested_tons <= 0 then
    raise exception 'Indica una cantidad de toneladas mayor que cero';
  end if;

  select profiles.full_name into admin_name
  from public.mvp_profiles profiles
  where profiles.user_id = (select auth.uid());

  select profiles.full_name into advisor_name
  from public.mvp_profiles profiles
  where profiles.user_id = target_advisor;

  insert into public.mvp_clients (name, type, advisor_id, department, city, tons_requested)
  values (trim(client_name), client_type, target_advisor, trim(target_department), trim(target_city), requested_tons)
  returning id into client_id;

  insert into public.mvp_notifications (recipient_id, kind, title, body, related_client_id)
  values (
    target_advisor,
    'client_assigned',
    '¡Topitín tiene una nueva misión! 🐧',
    format('¡Hola, %s! %s acaba de llegar a tu ruta comercial en %s. Topitín está feliz de acompañarte. ¿Vamos por esa primera tarea? 💙', advisor_name, trim(client_name), coalesce(nullif(trim(target_city), ''), 'tu territorio')),
    client_id
  )
  returning id into notification_id;

  update public.mvp_client_requests
  set status = 'handled', resolved_at = now(), resolved_by = (select auth.uid())
  where advisor_id = target_advisor and status = 'pending';

  return jsonb_build_object('client_id', client_id, 'notification_id', notification_id, 'assigned_by', admin_name);
end;
$$;
