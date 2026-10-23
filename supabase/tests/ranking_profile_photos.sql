-- Run on an isolated database with all migrations applied. Always rolls back.
begin;
insert into auth.users (id, email, raw_user_meta_data) values
  ('40000000-0000-4000-8000-000000000001', 'photo-a@example.invalid', '{"full_name":"Photo Advisor A"}'),
  ('40000000-0000-4000-8000-000000000002', 'photo-b@example.invalid', '{"full_name":"Photo Advisor B"}'),
  ('40000000-0000-4000-8000-000000000003', 'photo-admin@example.invalid', '{"full_name":"Photo Admin"}');
update public.mvp_profiles set avatar_path = user_id::text || '/current.png'
where user_id in ('40000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000003');
update public.mvp_profiles set role = 'admin' where user_id = '40000000-0000-4000-8000-000000000003';
insert into storage.objects (bucket_id, name) values
  ('advisor-profile-photos', '40000000-0000-4000-8000-000000000001/current.png'),
  ('advisor-profile-photos', '40000000-0000-4000-8000-000000000002/current.png'),
  ('advisor-profile-photos', '40000000-0000-4000-8000-000000000002/old.png'),
  ('advisor-profile-photos', '40000000-0000-4000-8000-000000000003/current.png');

do $$
begin
  if (select public from storage.buckets where id = 'advisor-profile-photos') then raise exception 'Photo bucket must remain private'; end if;
  if has_function_privilege('anon', 'public.get_mvp_advisor_avatars()', 'execute') then raise exception 'Anonymous callers must not read photo directory'; end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-4000-8000-000000000001', true);
do $$
declare affected integer;
begin
  if not exists (select 1 from public.get_mvp_advisor_avatars() where advisor_id = '40000000-0000-4000-8000-000000000002') then raise exception 'Advisor must see other advisor photo reference'; end if;
  if exists (select 1 from public.get_mvp_advisor_avatars() where advisor_id = '40000000-0000-4000-8000-000000000003') then raise exception 'Admin photo must not enter advisor directory'; end if;
  if not exists (select 1 from storage.objects where bucket_id = 'advisor-profile-photos' and name = '40000000-0000-4000-8000-000000000002/current.png') then raise exception 'Current ranking photo must be readable'; end if;
  if exists (select 1 from storage.objects where bucket_id = 'advisor-profile-photos' and name in ('40000000-0000-4000-8000-000000000002/old.png', '40000000-0000-4000-8000-000000000003/current.png')) then raise exception 'Unshared objects must remain private'; end if;
  update storage.objects set metadata = '{"unauthorized":true}' where bucket_id = 'advisor-profile-photos' and name = '40000000-0000-4000-8000-000000000002/current.png';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Cannot update another advisor photo'; end if;
  delete from storage.objects where bucket_id = 'advisor-profile-photos' and name = '40000000-0000-4000-8000-000000000002/current.png';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Cannot delete another advisor photo'; end if;
  begin
    insert into storage.objects (bucket_id, name) values ('advisor-profile-photos', '40000000-0000-4000-8000-000000000002/unauthorized.png');
    raise exception 'Cannot upload into another advisor folder';
  exception when insufficient_privilege then null;
  end;
  insert into storage.objects (bucket_id, name) values ('advisor-profile-photos', '40000000-0000-4000-8000-000000000001/own-test.png');
  delete from storage.objects where bucket_id = 'advisor-profile-photos' and name = '40000000-0000-4000-8000-000000000001/own-test.png';
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Owner write permissions must remain available'; end if;
end;
$$;

select set_config('request.jwt.claim.sub', '40000000-0000-4000-8000-000000000003', true);
do $$
begin
  if not exists (select 1 from storage.objects where bucket_id = 'advisor-profile-photos' and name = '40000000-0000-4000-8000-000000000002/current.png') then raise exception 'Admin must read current advisor photo'; end if;
end;
$$;

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
do $$
begin
  if exists (select 1 from storage.objects where bucket_id = 'advisor-profile-photos' and name = '40000000-0000-4000-8000-000000000002/current.png') then raise exception 'Anonymous visitors must not read private photos'; end if;
end;
$$;
reset role;
rollback;
