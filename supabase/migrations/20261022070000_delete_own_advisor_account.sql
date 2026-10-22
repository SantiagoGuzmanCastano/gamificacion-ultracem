create or replace function public.delete_mvp_own_account()
returns void
language plpgsql
security definer
set search_path = public, auth, storage
as $$
declare
  target_id uuid := auth.uid();
begin
  if target_id is null then
    raise exception 'Authentication required';
  end if;
  if not exists (select 1 from public.mvp_profiles where user_id = target_id and role = 'advisor') then
    raise exception 'Only advisor accounts can be deleted here';
  end if;

  delete from storage.objects
  where bucket_id = 'advisor-profile-photos'
    and (storage.foldername(name))[1] = target_id::text;
  delete from public.mvp_clients where advisor_id = target_id;
  delete from public.mvp_profiles where user_id = target_id;
  delete from auth.users where id = target_id;
end;
$$;

revoke all on function public.delete_mvp_own_account() from public, anon, authenticated;
grant execute on function public.delete_mvp_own_account() to authenticated;
