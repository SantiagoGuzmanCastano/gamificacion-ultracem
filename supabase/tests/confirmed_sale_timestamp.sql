-- Run against an isolated database with all migrations applied. All fixtures roll back.
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('20000000-0000-4000-8000-000000000001', 'timestamp-advisor@example.invalid', '{"full_name":"Timestamp Advisor"}');

insert into public.mvp_clients (id, name, type, advisor_id, tons_requested)
values
  ('20000000-0000-4000-8000-000000000010', 'Timestamp Client', 'Ferretería', '20000000-0000-4000-8000-000000000001', 12.50),
  ('20000000-0000-4000-8000-000000000011', 'Timestamp Client 2', 'Ferretería', '20000000-0000-4000-8000-000000000001', 7.25);

insert into public.mvp_sales (client_id, advisor_id, amount, confirmed, tons_sold)
values ('20000000-0000-4000-8000-000000000010', '20000000-0000-4000-8000-000000000001', 1000, false, null);

update public.mvp_tasks
set completed_at = now()
where client_id = '20000000-0000-4000-8000-000000000010';

update public.mvp_tasks
set completed_at = now()
where client_id = '20000000-0000-4000-8000-000000000011';

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000001', true);

select public.confirm_mvp_sale('20000000-0000-4000-8000-000000000010');
select public.confirm_mvp_sale('20000000-0000-4000-8000-000000000011');

do $$
declare
  sale public.mvp_sales;
  inserted_sale public.mvp_sales;
begin
  select * into sale
  from public.mvp_sales
  where client_id = '20000000-0000-4000-8000-000000000010';

  if not sale.confirmed or sale.confirmed_at is null or sale.tons_sold <> 12.50 then
    raise exception 'Expected confirmed sale timestamp and requested tons';
  end if;

  if sale.confirmed_at < sale.completed_at then
    raise exception 'Confirmation timestamp cannot precede sale creation timestamp';
  end if;

  select * into inserted_sale
  from public.mvp_sales
  where client_id = '20000000-0000-4000-8000-000000000011';

  if not inserted_sale.confirmed or inserted_sale.confirmed_at is null or inserted_sale.tons_sold <> 7.25 then
    raise exception 'Expected inserted sale confirmation timestamp and requested tons';
  end if;

  begin
    perform public.confirm_mvp_sale('20000000-0000-4000-8000-000000000010');
    raise exception 'Repeated confirmation must fail';
  exception when others then
    if sqlerrm <> 'Sale is already confirmed' then raise; end if;
  end;
end;
$$;

rollback;
