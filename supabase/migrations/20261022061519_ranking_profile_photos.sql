-- Expose only current advisor photo references, not the rest of each profile.
create function public.get_mvp_advisor_avatars()
returns table (advisor_id uuid, avatar_path text)
language sql stable security definer set search_path = ''
as $$
  select profiles.user_id, profiles.avatar_path
  from public.mvp_profiles profiles
  where (select auth.uid()) is not null
    and profiles.role = 'advisor'
    and profiles.avatar_path is not null
    and split_part(profiles.avatar_path, '/', 1) = profiles.user_id::text;
$$;

revoke all on function public.get_mvp_advisor_avatars() from public, anon;
grant execute on function public.get_mvp_advisor_avatars() to authenticated;

-- The bucket stays private. Existing owner-only write policies stay unchanged.
create policy "advisor_profile_photos_read_ranking" on storage.objects
for select to authenticated
using (
  bucket_id = 'advisor-profile-photos'
  and name in (select photos.avatar_path from public.get_mvp_advisor_avatars() photos)
);
