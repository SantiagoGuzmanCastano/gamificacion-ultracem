create table public.mvp_app_settings (
  id boolean primary key default true check (id),
  halloween_enabled boolean not null default false
);

insert into public.mvp_app_settings (id, halloween_enabled) values (true, false);

alter table public.mvp_app_settings enable row level security;

revoke all on public.mvp_app_settings from public, anon, authenticated;
grant select on public.mvp_app_settings to authenticated;
grant update (halloween_enabled) on public.mvp_app_settings to authenticated;

create policy "settings_authenticated_read" on public.mvp_app_settings
for select to authenticated using (true);

create policy "settings_admin_update" on public.mvp_app_settings
for update to authenticated
using ((select app_private.is_admin()))
with check ((select app_private.is_admin()));
