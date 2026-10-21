-- Run against an isolated database with all migrations applied. All fixtures roll back.
begin;
insert into auth.users (id, email, raw_user_meta_data) values
  ('10000000-0000-4000-8000-000000000001', 'halloween-admin@example.invalid', '{"full_name":"Halloween Admin"}'),
  ('10000000-0000-4000-8000-000000000002', 'halloween-advisor@example.invalid', '{"full_name":"Halloween Advisor"}');
update public.mvp_profiles set role = 'admin' where user_id = '10000000-0000-4000-8000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
do $$
declare changed integer;
begin
  if (select count(*) from public.mvp_app_settings) <> 1
    or (select halloween_enabled from public.mvp_app_settings) then
    raise exception 'Expected one disabled global setting';
  end if;
  update public.mvp_app_settings set halloween_enabled = true where id = true;
  get diagnostics changed = row_count;
  if changed <> 0 or (select halloween_enabled from public.mvp_app_settings) then
    raise exception 'Advisor must not activate Halloween';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
update public.mvp_app_settings set halloween_enabled = true where id = true;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
do $$
begin
  if not (select halloween_enabled from public.mvp_app_settings) then
    raise exception 'Advisor must read the globally enabled setting';
  end if;
  update public.mvp_app_settings set halloween_enabled = false where id = true;
  if not (select halloween_enabled from public.mvp_app_settings) then
    raise exception 'Advisor must not deactivate Halloween';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
do $$
begin
  begin
    update public.mvp_app_settings set id = false;
    raise exception 'Administrator must not change singleton identity';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.mvp_app_settings values (false, true);
    raise exception 'Administrator must not create settings rows';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.mvp_app_settings;
    raise exception 'Administrator must not delete settings';
  exception when insufficient_privilege then null;
  end;
end;
$$;
update public.mvp_app_settings set halloween_enabled = false where id = true;
do $$ begin
  if (select halloween_enabled from public.mvp_app_settings) then
    raise exception 'Administrator must be able to deactivate Halloween';
  end if;
end; $$;

set local role anon;
do $$ begin
  begin
    perform halloween_enabled from public.mvp_app_settings;
    raise exception 'Anonymous users must not read settings';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.mvp_app_settings set halloween_enabled = true;
    raise exception 'Anonymous users must not update settings';
  exception when insufficient_privilege then null;
  end;
end; $$;
rollback;
