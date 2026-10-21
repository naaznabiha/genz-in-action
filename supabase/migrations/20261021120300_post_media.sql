-- =============================================================================
-- Migration 20261021120300_post_media
-- Phase 3 · Step 4 of 10
-- =============================================================================
-- Creates : • public.post_media (one optional photo per post for the MVP)
--           • public.validate_post_media() + trigger (file must exist in the
--             post author's own folder)
--           • PRIVATE storage bucket `post-media` (JPEG/PNG, 5 MB) + policies
-- Depends : 20261021120200_posts.
-- Safe to re-run : yes (bucket upserted, policies recreated by name).
-- Destructive    : no.
-- Spec    : §10 post_media, §12 "Storage buckets require policies matching the
--           ownership/privacy model", brief: "readable only by people allowed
--           to see the post".
--
-- Read rule: a photo can be read (signed URL) by its uploader, or by anyone who
-- can see a post that uses it. The second check reuses post_media's own RLS,
-- which reuses public.can_view_author_content(), so a private account's photos
-- follow exactly the same rule as its posts.
-- Files: <author id>/post-<10–16 digits>.jpg|png. No UPDATE policy (no
-- overwrites). Deleting a post removes its post_media row (cascade); the app
-- then deletes the file through the Storage API (hosted Supabase forbids SQL
-- deletes on storage tables). A file left behind is unreadable to others.
-- =============================================================================

create table if not exists public.post_media (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null references public.posts (id) on delete cascade,
  storage_path text not null unique
               constraint post_media_path_format check (storage_path ~ '^[0-9a-f-]{36}/post-[0-9]{10,16}\.(jpg|png)$'),
  width        integer constraint post_media_width_range check (width is null or width between 1 and 10000),
  height       integer constraint post_media_height_range check (height is null or height between 1 and 10000),
  position     smallint not null default 0
               constraint post_media_single_photo check (position = 0),   -- MVP: one photo per post
  created_at   timestamptz not null default now(),
  unique (post_id, position)
);

comment on table public.post_media is 'GenZ in Action: photo attached to a post (MVP: at most one). Visible with its post.';

create or replace function public.validate_post_media()
returns trigger
language plpgsql
security definer          -- reads posts/storage.objects regardless of the caller's RLS
set search_path = ''
as $$
declare
  author uuid;
begin
  select p.author_id into author from public.posts p where p.id = new.post_id;
  if author is null then
    raise exception using errcode = '23503', message = 'GENZ_POST_NOT_FOUND: the post does not exist';
  end if;
  if split_part(new.storage_path, '/', 1) <> author::text
     or not exists (select 1 from storage.objects o
                     where o.bucket_id = 'post-media' and o.name = new.storage_path) then
    raise exception using
      errcode = '22023',
      message = 'GENZ_MEDIA_NOT_FOUND: upload the photo to your own folder before attaching it';
  end if;
  return new;
end;
$$;
revoke execute on function public.validate_post_media() from public, anon, authenticated;

create or replace trigger post_media_validate
  before insert or update of storage_path, post_id on public.post_media
  for each row execute function public.validate_post_media();

revoke all on table public.post_media from anon, authenticated;
grant select, delete on table public.post_media to authenticated;
grant insert (post_id, storage_path, width, height) on table public.post_media to authenticated;

alter table public.post_media enable row level security;

drop policy if exists "post_media_select_visible" on public.post_media;
create policy "post_media_select_visible"
  on public.post_media for select to authenticated
  using (exists (select 1 from public.posts p
                  where p.id = post_id and public.can_view_author_content(p.author_id)));

drop policy if exists "post_media_insert_own_post" on public.post_media;
create policy "post_media_insert_own_post"
  on public.post_media for insert to authenticated
  with check (exists (select 1 from public.posts p
                       where p.id = post_id and p.author_id = (select auth.uid())));

drop policy if exists "post_media_delete_own_post" on public.post_media;
create policy "post_media_delete_own_post"
  on public.post_media for delete to authenticated
  using (exists (select 1 from public.posts p
                  where p.id = post_id and p.author_id = (select auth.uid())));

-- ---------------------------------------------------------------- storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-media', 'post-media', false, 5242880, array['image/jpeg', 'image/png'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "post_media_insert_own_folder" on storage.objects;
create policy "post_media_insert_own_folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'post-media'
    and (select auth.uid()) is not null
    and array_length(storage.foldername(name), 1) = 1
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and storage.filename(name) ~ '^post-[0-9]{10,16}\.(jpg|png)$'
  );

drop policy if exists "post_media_select_allowed" on storage.objects;
create policy "post_media_select_allowed"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'post-media'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (select 1 from public.post_media pm where pm.storage_path = name)
    )
  );

drop policy if exists "post_media_delete_own_folder" on storage.objects;
create policy "post_media_delete_own_folder"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
