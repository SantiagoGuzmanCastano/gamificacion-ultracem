create schema if not exists app_private;

create table public.mvp_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (length(trim(full_name)) between 2 and 80),
  role text not null default 'advisor' check (role in ('admin', 'advisor')),
  created_at timestamptz not null default now()
);

create table public.mvp_clients (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 100),
  type text not null check (type in ('Ferretería', 'Constructora', 'Distribuidor', 'Otro')),
  advisor_id uuid not null references public.mvp_profiles(user_id),
  created_at timestamptz not null default now()
);

create table public.mvp_tasks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.mvp_clients(id) on delete cascade,
  title text not null,
  description text not null,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index mvp_clients_advisor_id_idx on public.mvp_clients(advisor_id);
create index mvp_tasks_client_id_idx on public.mvp_tasks(client_id);

create function app_private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.mvp_profiles
    where user_id = (select auth.uid()) and role = 'admin'
  );
$$;

create function app_private.is_advisor(target_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.mvp_profiles
    where user_id = target_id and role = 'advisor'
  );
$$;

create function app_private.handle_new_mvp_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.mvp_profiles (user_id, full_name)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)), 80)
  );
  return new;
end;
$$;

create trigger on_auth_user_created_mvp
after insert on auth.users
for each row execute function app_private.handle_new_mvp_user();

create function app_private.create_mvp_tasks() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.mvp_tasks (client_id, title, description) values
    (new.id, 'Preparar una visita', 'Define el objetivo de una visita comercial.'),
    (new.id, 'Contactar al cliente', 'Registra una llamada de seguimiento.'),
    (new.id, 'Revisar una cotización', 'Confirma si una cotización sigue vigente.'),
    (new.id, 'Planear el siguiente paso', 'Define la próxima acción para este cliente.');
  return new;
end;
$$;

create trigger on_mvp_client_created
after insert on public.mvp_clients
for each row execute function app_private.create_mvp_tasks();

alter table public.mvp_profiles enable row level security;
alter table public.mvp_clients enable row level security;
alter table public.mvp_tasks enable row level security;

create policy "profiles_self_or_admin_read" on public.mvp_profiles
for select to authenticated
using (user_id = (select auth.uid()) or (select app_private.is_admin()));

create policy "clients_admin_or_owner_read" on public.mvp_clients
for select to authenticated
using ((select app_private.is_admin()) or advisor_id = (select auth.uid()));

create policy "clients_admin_create" on public.mvp_clients
for insert to authenticated
with check ((select app_private.is_admin()) and app_private.is_advisor(advisor_id));

create policy "tasks_admin_or_owner_read" on public.mvp_tasks
for select to authenticated
using ((select app_private.is_admin()) or exists (
  select 1 from public.mvp_clients
  where id = client_id and advisor_id = (select auth.uid())
));

create policy "tasks_owner_complete" on public.mvp_tasks
for update to authenticated
using (completed_at is null and exists (
  select 1 from public.mvp_clients
  where id = client_id and advisor_id = (select auth.uid())
))
with check (completed_at is not null and exists (
  select 1 from public.mvp_clients
  where id = client_id and advisor_id = (select auth.uid())
));

revoke all on public.mvp_profiles, public.mvp_clients, public.mvp_tasks from anon, authenticated;
grant select on public.mvp_profiles to authenticated;
grant select, insert on public.mvp_clients to authenticated;
grant select on public.mvp_tasks to authenticated;
grant update (completed_at) on public.mvp_tasks to authenticated;
grant usage on schema app_private to authenticated;
grant execute on function app_private.is_admin() to authenticated;
grant execute on function app_private.is_advisor(uuid) to authenticated;
