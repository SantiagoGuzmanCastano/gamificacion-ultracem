-- Run only on an isolated database with project migrations applied:
-- psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/admin_read_client_requests.sql
-- Fails before admin_read_client_requests; all fixtures roll back on success.
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('60000000-0000-4000-8000-000000000001', 'request-advisor-a@example.invalid', '{"full_name":"Request Advisor A"}'),
  ('60000000-0000-4000-8000-000000000002', 'request-advisor-b@example.invalid', '{"full_name":"Request Advisor B"}'),
  ('60000000-0000-4000-8000-000000000003', 'request-admin@example.invalid', '{"full_name":"Request Admin"}');
update public.mvp_profiles set role = 'admin'
where user_id = '60000000-0000-4000-8000-000000000003';

insert into public.mvp_client_requests (id, advisor_id, status) values
  ('60000000-0000-4000-8000-000000000010', '60000000-0000-4000-8000-000000000001', 'pending'),
  ('60000000-0000-4000-8000-000000000011', '60000000-0000-4000-8000-000000000002', 'handled');

do $$
declare role_name text; privilege_name text;
begin
  if not (select relrowsecurity from pg_class where oid = 'public.mvp_client_requests'::regclass) then
    raise exception 'Client requests must keep RLS enabled';
  end if;
  if has_table_privilege('anon', 'public.mvp_client_requests', 'SELECT') then
    raise exception 'Anonymous callers must not have SELECT permission';
  end if;
  foreach role_name in array array['anon', 'authenticated'] loop
    foreach privilege_name in array array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'] loop
      if has_table_privilege(role_name, 'public.mvp_client_requests', privilege_name) then
        raise exception '% must not have direct % permission', role_name, privilege_name;
      end if;
    end loop;
  end loop;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '60000000-0000-4000-8000-000000000003', true);

do $$
begin
  if not (select app_private.is_admin()) then raise exception 'Admin fixture must be an admin'; end if;
  if (select count(*) from public.mvp_client_requests
      where id in ('60000000-0000-4000-8000-000000000010', '60000000-0000-4000-8000-000000000011')) <> 2 then
    raise exception 'Admin must read requests from both advisors';
  end if;
  if not exists (select 1 from public.mvp_client_requests
                 where id = '60000000-0000-4000-8000-000000000010'
                   and advisor_id = '60000000-0000-4000-8000-000000000001'
                   and status = 'pending') then
    raise exception 'Admin must read the advisor and status used by notification actions';
  end if;
  begin
    insert into public.mvp_client_requests (advisor_id)
    values ('60000000-0000-4000-8000-000000000003');
    raise exception 'Admin must not insert requests directly';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.mvp_client_requests set status = 'handled'
    where id = '60000000-0000-4000-8000-000000000010';
    raise exception 'Admin must not update requests directly';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.mvp_client_requests where id = '60000000-0000-4000-8000-000000000010';
    raise exception 'Admin must not delete requests directly';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '60000000-0000-4000-8000-000000000001', true);
do $$
begin
  if (select app_private.is_admin()) then raise exception 'Advisor fixture must not be an admin'; end if;
  if exists (select 1 from public.mvp_client_requests) then
    raise exception 'Advisor must not read own or other advisors requests directly';
  end if;
end;
$$;

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
do $$
begin
  begin
    perform 1 from public.mvp_client_requests;
    raise exception 'Anonymous callers must not read client requests';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
do $$
begin
  if (select status from public.mvp_client_requests where id = '60000000-0000-4000-8000-000000000010') <> 'pending'
     or (select count(*) from public.mvp_client_requests
         where id in ('60000000-0000-4000-8000-000000000010', '60000000-0000-4000-8000-000000000011')) <> 2 then
    raise exception 'Rejected writes must leave fixture requests unchanged';
  end if;
end;
$$;
rollback;
