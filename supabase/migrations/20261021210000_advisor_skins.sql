alter table public.mvp_profiles
  add column equipped_skin text not null default 'classic'
  check (equipped_skin in ('classic', 'skeleton'));

create or replace function public.equip_mvp_skin(target_skin text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  completed_count bigint;
  halloween boolean;
begin
  if (select role from public.mvp_profiles where user_id = (select auth.uid())) <> 'advisor' then
    raise exception 'Only advisors can equip skins';
  end if;
  if target_skin = 'classic' then
    update public.mvp_profiles set equipped_skin = 'classic' where user_id = (select auth.uid());
    return 'classic';
  end if;
  if target_skin <> 'skeleton' then raise exception 'Skin is not available'; end if;
  select halloween_enabled into halloween from public.mvp_app_settings where id = true;
  if not coalesce(halloween, false) then raise exception 'Halloween mode is not active'; end if;
  select count(*) into completed_count
  from public.mvp_tasks tasks
  join public.mvp_clients clients on clients.id = tasks.client_id
  where clients.advisor_id = (select auth.uid()) and tasks.completed_at is not null;
  if completed_count * 10 < 40 then raise exception 'Not enough XP to equip this skin'; end if;
  update public.mvp_profiles set equipped_skin = 'skeleton' where user_id = (select auth.uid());
  return 'skeleton';
end;
$$;

revoke all on function public.equip_mvp_skin(text) from public, anon;
grant execute on function public.equip_mvp_skin(text) to authenticated;
