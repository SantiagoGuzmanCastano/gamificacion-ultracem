-- Run on an isolated database with all migrations applied.
begin;
insert into auth.users (id, email, raw_user_meta_data) values
  ('30000000-0000-4000-8000-000000000001', 'skeleton-advisor@example.invalid', '{"full_name":"Skeleton Advisor"}');
update public.mvp_app_settings set halloween_enabled = true where id = true;
insert into public.mvp_clients (id, name, type, advisor_id, tons_requested) values
  ('30000000-0000-4000-8000-000000000010', 'Skeleton Client 1', 'Ferretería', '30000000-0000-4000-8000-000000000001', 1),
  ('30000000-0000-4000-8000-000000000011', 'Skeleton Client 2', 'Ferretería', '30000000-0000-4000-8000-000000000001', 1);
insert into public.mvp_sales (client_id, advisor_id, amount, confirmed, tons_sold) values
  ('30000000-0000-4000-8000-000000000010', '30000000-0000-4000-8000-000000000001', 100, true, 1),
  ('30000000-0000-4000-8000-000000000011', '30000000-0000-4000-8000-000000000001', 100, false, null);
set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000001', true);
do $$
begin
  begin
    perform public.equip_mvp_skin('skeleton');
    raise exception 'Expected one confirmed sale to remain locked';
  exception when others then
    if sqlerrm <> 'Not enough confirmed sales to equip this skin' then raise; end if;
  end;
end;
$$;
reset role;
update public.mvp_sales set confirmed = true, tons_sold = 1
where client_id = '30000000-0000-4000-8000-000000000011';
set local role authenticated;
do $$
begin
  if public.equip_mvp_skin('skeleton') <> 'skeleton' then raise exception 'Expected skeleton after second sale'; end if;
  if (select equipped_skin from public.mvp_profiles where user_id = (select auth.uid())) <> 'skeleton' then raise exception 'Expected equipped skin to be saved'; end if;
  if public.equip_mvp_skin('classic') <> 'classic' then raise exception 'Expected classic to remain available'; end if;
end;
$$;
rollback;
