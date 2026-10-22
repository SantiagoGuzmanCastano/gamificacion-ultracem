alter table public.mvp_profiles
  add column if not exists avatar_path text,
  add column if not exists photo_prompted_at timestamptz;

update public.mvp_profiles
set photo_prompted_at = coalesce(photo_prompted_at, created_at)
where photo_prompted_at is null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('advisor-profile-photos', 'advisor-profile-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'advisor-profile-photos';

create policy "advisor_profile_photos_read_own" on storage.objects
for select to authenticated
using (bucket_id = 'advisor-profile-photos' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "advisor_profile_photos_insert_own" on storage.objects
for insert to authenticated
with check (bucket_id = 'advisor-profile-photos' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "advisor_profile_photos_update_own" on storage.objects
for update to authenticated
using (bucket_id = 'advisor-profile-photos' and (storage.foldername(name))[1] = (select auth.uid()::text))
with check (bucket_id = 'advisor-profile-photos' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "advisor_profile_photos_delete_own" on storage.objects
for delete to authenticated
using (bucket_id = 'advisor-profile-photos' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "profiles_self_update" on public.mvp_profiles
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

grant update (avatar_path, photo_prompted_at) on public.mvp_profiles to authenticated;
