create table public.mvp_client_requests (
  id uuid primary key default gen_random_uuid(),
  advisor_id uuid not null references public.mvp_profiles(user_id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'handled', 'rejected')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.mvp_profiles(user_id)
);

create unique index mvp_client_requests_one_pending_per_advisor
  on public.mvp_client_requests(advisor_id) where status = 'pending';

create table public.mvp_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.mvp_profiles(user_id) on delete cascade,
  kind text not null check (kind in ('client_request', 'client_assigned')),
  title text not null check (length(trim(title)) between 2 and 120),
  body text not null check (length(trim(body)) between 2 and 500),
  related_request_id uuid references public.mvp_client_requests(id) on delete cascade,
  related_client_id uuid references public.mvp_clients(id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index mvp_notifications_recipient_created_idx
  on public.mvp_notifications(recipient_id, created_at desc);

alter table public.mvp_client_requests enable row level security;
alter table public.mvp_notifications enable row level security;

revoke all on public.mvp_client_requests, public.mvp_notifications from anon, authenticated;
grant select on public.mvp_notifications to authenticated;

create policy "notifications_recipient_read" on public.mvp_notifications
for select to authenticated
using (recipient_id = (select auth.uid()));

alter publication supabase_realtime add table public.mvp_notifications;

create or replace function public.request_mvp_client()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_id uuid;
  notification_ids jsonb;
  advisor_name text;
begin
  if (select auth.uid()) is null then
    raise exception 'You must be signed in';
  end if;

  select profiles.full_name into advisor_name
  from public.mvp_profiles profiles
  where profiles.user_id = (select auth.uid()) and profiles.role = 'advisor';
  if advisor_name is null then
    raise exception 'Only advisors can request a client';
  end if;

  insert into public.mvp_client_requests (advisor_id)
  values ((select auth.uid()))
  on conflict (advisor_id) where status = 'pending' do nothing
  returning id into request_id;

  if request_id is null then
    select requests.id into request_id
    from public.mvp_client_requests requests
    where requests.advisor_id = (select auth.uid()) and requests.status = 'pending';
    return jsonb_build_object('request_id', request_id, 'notification_ids', '[]'::jsonb, 'duplicate', true);
  end if;

  with inserted as (
    insert into public.mvp_notifications (recipient_id, kind, title, body, related_request_id)
    select profiles.user_id, 'client_request', 'Solicitud de cliente', advisor_name || ' solicitó un nuevo cliente.', request_id
    from public.mvp_profiles profiles
    where profiles.role = 'admin'
    returning id
  )
  select coalesce(jsonb_agg(inserted.id), '[]'::jsonb) into notification_ids from inserted;

  return jsonb_build_object('request_id', request_id, 'notification_ids', notification_ids, 'duplicate', false);
end;
$$;

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

  insert into public.mvp_clients (name, type, advisor_id, department, city, tons_requested)
  values (trim(client_name), client_type, target_advisor, trim(target_department), trim(target_city), requested_tons)
  returning id into client_id;

  insert into public.mvp_notifications (recipient_id, kind, title, body, related_client_id)
  values (target_advisor, 'client_assigned', 'Nuevo cliente asignado', 'Tienes un nuevo cliente en tus próximas acciones.', client_id)
  returning id into notification_id;

  update public.mvp_client_requests
  set status = 'handled', resolved_at = now(), resolved_by = (select auth.uid())
  where advisor_id = target_advisor and status = 'pending';

  return jsonb_build_object('client_id', client_id, 'notification_id', notification_id, 'assigned_by', admin_name);
end;
$$;

create function public.mark_mvp_notification_read(target_notification uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  update public.mvp_notifications
  set read_at = coalesce(read_at, now())
  where id = target_notification and recipient_id = (select auth.uid())
  returning true;
$$;

revoke all on function public.request_mvp_client() from public, anon;
grant execute on function public.request_mvp_client() to authenticated;
revoke all on function public.assign_mvp_client(text, text, uuid, text, text, numeric) from public, anon;
grant execute on function public.assign_mvp_client(text, text, uuid, text, text, numeric) to authenticated;
revoke all on function public.mark_mvp_notification_read(uuid) from public, anon;
grant execute on function public.mark_mvp_notification_read(uuid) to authenticated;
