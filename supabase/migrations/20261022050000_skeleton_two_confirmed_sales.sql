create or replace function public.equip_mvp_skin(target_skin text)
returns text language plpgsql security definer set search_path = ''
as $$
declare confirmed_sales bigint;
begin
  if (select role from public.mvp_profiles where user_id = (select auth.uid())) <> 'advisor' then raise exception 'Only advisors can equip skins'; end if;
  if target_skin = 'classic' then update public.mvp_profiles set equipped_skin = 'classic' where user_id = (select auth.uid()); return 'classic'; end if;
  if target_skin <> 'skeleton' then raise exception 'Skin is not available'; end if;
  if not coalesce((select halloween_enabled from public.mvp_app_settings where id = true), false) then raise exception 'Halloween mode is not active'; end if;
  select count(*) into confirmed_sales from public.mvp_sales where advisor_id = (select auth.uid()) and confirmed;
  if confirmed_sales < 2 then raise exception 'Not enough confirmed sales to equip this skin'; end if;
  update public.mvp_profiles set equipped_skin = 'skeleton' where user_id = (select auth.uid());
  return 'skeleton';
end;
$$;
