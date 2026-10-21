-- =============================================================================
-- Migration 20261021100200_avatars_storage
-- Phase 2 · Step 3 of 8
-- =============================================================================
-- Creates : • Storage bucket `avatars` (public read, JPEG/PNG only, max 5 MB)
--           • RLS policies on storage.objects for that bucket
-- Depends : nothing in public; uses Supabase's storage schema.
-- Safe to re-run : yes. The bucket is upserted (limits are re-applied if the
--           bucket already exists); policies are recreated by name.
-- Destructive    : no objects are deleted. If an `avatars` bucket already
--           exists, its public flag / size limit / MIME list are set to the
--           values below (check supabase/checks/05_preflight_phase2.sql first).
-- Spec    : §8 Media, §12 "Storage buckets require policies matching the
--           ownership/privacy model", "Validate media types/sizes".
--
-- Path rule: every avatar lives at  <auth.uid()>/avatar-<10–16 digits>.<jpg|png>
--   • INSERT  : only into your own folder, only that file-name shape, one level.
--   • SELECT  : only your own folder (needed by the Storage API for delete).
--   • DELETE  : only your own folder.
--   • UPDATE  : no policy → nobody can overwrite any object, including their own.
--               The app uploads a new file name each time instead.
-- Public read: profile photos are shown to every signed-in user, so the bucket
-- is public (served by URL, no RLS on download). Decision D19 — please confirm.
-- If the policy statements fail with "must be owner of table objects", create
-- the same four policies in Dashboard → Storage → Policies (see README).
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars_insert_own_folder" on storage.objects;
create policy "avatars_insert_own_folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (select auth.uid()) is not null
    and array_length(storage.foldername(name), 1) = 1
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and storage.filename(name) ~ '^avatar-[0-9]{10,16}\.(jpg|png)$'
  );

drop policy if exists "avatars_select_own_folder" on storage.objects;
create policy "avatars_select_own_folder"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "avatars_delete_own_folder" on storage.objects;
create policy "avatars_delete_own_folder"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Remove any update policy this project may have had under our name.
drop policy if exists "avatars_update_own_folder" on storage.objects;
