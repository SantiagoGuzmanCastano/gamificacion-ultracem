alter table public.mvp_sales
  add column confirmed_at timestamptz;

create index mvp_sales_confirmed_at_idx
  on public.mvp_sales(advisor_id, confirmed_at)
  where confirmed = true;

create or replace function public.confirm_mvp_sale(target_client uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare advisor uuid; sale_id uuid; requested_tons numeric;
begin
  select clients.advisor_id, clients.tons_requested into advisor, requested_tons
  from public.mvp_clients clients where clients.id = target_client;
  if advisor is null or advisor <> (select auth.uid()) then raise exception 'Client is not assigned to this advisor'; end if;
  if requested_tons is null or requested_tons <= 0 then raise exception 'Client has no valid tons value'; end if;
  if (select count(*) from public.mvp_tasks where client_id = target_client and completed_at is not null) <> 4 then raise exception 'All four tasks must be completed'; end if;
  update public.mvp_sales set confirmed = true, tons_sold = requested_tons, confirmed_at = now()
  where client_id = target_client and advisor_id = advisor and not confirmed
  returning id into sale_id;
  if sale_id is null then
    insert into public.mvp_sales (client_id, advisor_id, amount, confirmed, tons_sold, confirmed_at)
    values (target_client, advisor, floor(random() * 900000 + 100000)::numeric, true, requested_tons, now())
    on conflict (client_id) do nothing returning id into sale_id;
  end if;
  if sale_id is null then raise exception 'Sale is already confirmed'; end if;
  return sale_id;
end;
$$;
