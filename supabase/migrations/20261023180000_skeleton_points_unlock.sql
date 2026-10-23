-- El Pingüino Esqueleto se desbloquea con 100 puntos (una venta confirmada equivale
-- a 100 puntos). Los puntos no se descuentan: el precio de la tienda es conceptual.
create or replace function public.equip_mvp_skin(target_skin text)
returns text language plpgsql security definer set search_path = ''
as $$
declare advisor_points integer;
begin
  if (select role from public.mvp_profiles where user_id = (select auth.uid())) <> 'advisor' then raise exception 'Only advisors can equip skins'; end if;
  if target_skin = 'classic' then update public.mvp_profiles set equipped_skin = 'classic' where user_id = (select auth.uid()); return 'classic'; end if;
  if target_skin <> 'skeleton' then raise exception 'Skin is not available'; end if;
  if not coalesce((select halloween_enabled from public.mvp_app_settings where id = true), false) then raise exception 'Halloween mode is not active'; end if;
  select coalesce(points, 0) into advisor_points from public.mvp_profiles where user_id = (select auth.uid());
  if advisor_points < 100 then raise exception 'Necesitas 100 puntos para equipar esta skin'; end if;
  update public.mvp_profiles set equipped_skin = 'skeleton' where user_id = (select auth.uid());
  return 'skeleton';
end;
$$;
