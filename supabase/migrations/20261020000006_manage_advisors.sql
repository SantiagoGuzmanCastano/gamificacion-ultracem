create or replace function public.get_mvp_advisors()
returns table (user_id uuid, full_name text, role text, email text)
language sql
security definer
set search_path = ''
as $$
  select profiles.user_id, profiles.full_name, profiles.role, users.email
  from public.mvp_profiles as profiles
  join auth.users as users on users.id = profiles.user_id
  where profiles.role = 'advisor'
    and (select app_private.is_admin());
$$;

create or replace function public.delete_mvp_advisor(target_advisor uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select app_private.is_admin()) then
    raise exception 'Solo un administrador puede borrar asesores';
  end if;

  delete from public.mvp_clients where advisor_id = target_advisor;
  delete from auth.users where id = target_advisor;
end;
$$;

revoke all on function public.get_mvp_advisors() from public, anon;
grant execute on function public.get_mvp_advisors() to authenticated;
revoke all on function public.delete_mvp_advisor(uuid) from public, anon;
grant execute on function public.delete_mvp_advisor(uuid) to authenticated;
