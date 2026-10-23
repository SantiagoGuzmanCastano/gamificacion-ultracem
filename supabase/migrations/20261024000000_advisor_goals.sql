-- PRD A5: el administrador define por asesor la participación objetivo y los clientes objetivo.
-- advisor_key es el user_id del asesor real o "sample-01"… para los asesores de muestra de la demo.
-- Meta en toneladas = market_tons × target_share (se calcula en el frontend).
create table public.mvp_advisor_goals (
  advisor_key text primary key,
  market_tons numeric not null default 1000 check (market_tons > 0),
  target_share numeric not null default 0.10 check (target_share > 0 and target_share <= 1),
  target_clients integer not null default 50 check (target_clients > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.mvp_profiles(user_id) on delete set null
);

create index mvp_advisor_goals_updated_by_idx on public.mvp_advisor_goals (updated_by);

alter table public.mvp_advisor_goals enable row level security;

-- El admin ve todas las metas; cada asesor solo la suya. Las escrituras van por la función.
create policy "goals readable by admin or owner" on public.mvp_advisor_goals
for select to authenticated
using ((select app_private.is_admin()) or advisor_key = (select auth.uid())::text);

create or replace function public.set_mvp_advisor_goal(target_key text, new_target_share numeric, new_target_clients integer, new_market_tons numeric)
returns public.mvp_advisor_goals
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.mvp_advisor_goals;
begin
  if not (select app_private.is_admin()) then
    raise exception 'Solo un administrador puede editar metas';
  end if;

  insert into public.mvp_advisor_goals (advisor_key, target_share, target_clients, market_tons, updated_by)
  values (target_key, new_target_share, new_target_clients, new_market_tons, (select auth.uid()))
  on conflict (advisor_key) do update set
    target_share = excluded.target_share,
    target_clients = excluded.target_clients,
    market_tons = excluded.market_tons,
    updated_at = now(),
    updated_by = excluded.updated_by
  returning * into result;
  return result;
end;
$$;

revoke all on function public.set_mvp_advisor_goal(text, numeric, integer, numeric) from public, anon;
grant execute on function public.set_mvp_advisor_goal(text, numeric, integer, numeric) to authenticated;
