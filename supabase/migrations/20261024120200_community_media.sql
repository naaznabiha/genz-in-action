-- =============================================================================
-- Migration 20261024120200_community_media
-- Phase 6 · Step 3 of 8
-- =============================================================================
-- Creates : • PRIVATE bucket `community-media` — discussion attachments and
--             content files: JPEG/PNG (≤ 5 MB) and PDF (≤ 10 MB), decision D50
--           • PUBLIC bucket `community-images` — community cover images
--             (JPEG/PNG ≤ 5 MB), like avatars (D19): identity is public
--           • triggers that check every attachment really exists in the
--             author's folder, matches its declared kind and size limit, and
--             record its size
-- Depends : 20261024120000_communities_tables, 20261024120100_community_access.
-- Safe to re-run : yes (buckets upserted, policies/functions recreated).
-- Destructive    : no.
-- Spec    : §12 "a storage bucket for community media, with the same
--           membership rules".
--
-- community-media paths: <community id>/<uploader id>/(msg|content)-<10–16 digits>.(jpg|png|pdf)
--   upload  : only an ACTIVE member, only into <community>/<own id>/
--   read    : the uploader; or anyone who can read the message / content item
--             that uses the file (reuses those tables' RLS = can_read_community
--             + no blocked authors). A private community's files are therefore
--             never readable by non-members.
--   delete  : the uploader (own folder). No UPDATE policy (no overwrites).
-- community-images paths: <uploader id>/community-<10–16 digits>.(jpg|png)
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('community-media', 'community-media', false, 10485760, array['image/jpeg', 'image/png', 'application/pdf'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('community-images', 'community-images', true, 5242880, array['image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create index if not exists community_messages_attachment_idx on public.community_messages (attachment_path) where attachment_path is not null;
create index if not exists community_content_attachment_idx on public.community_content (attachment_path) where attachment_path is not null;

-- ---------------------------------------------------------------- community-media policies
drop policy if exists "community_media_insert_member_folder" on storage.objects;
create policy "community_media_insert_member_folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'community-media'
    and (select auth.uid()) is not null
    and array_length(storage.foldername(name), 1) = 2
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and storage.filename(name) ~ '^(msg|content)-[0-9]{10,16}\.(jpg|png|pdf)$'
    and exists (select 1 from public.community_members m
                 where m.community_id::text = (storage.foldername(name))[1]
                   and m.user_id = (select auth.uid()) and m.status = 'active')
  );

drop policy if exists "community_media_select_allowed" on storage.objects;
create policy "community_media_select_allowed"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'community-media'
    and (
      (storage.foldername(name))[2] = (select auth.uid())::text
      or exists (select 1 from public.community_messages m where m.attachment_path = name)   -- RLS: readable messages
      or exists (select 1 from public.community_content c where c.attachment_path = name)    -- RLS: readable content
    )
  );

drop policy if exists "community_media_delete_own" on storage.objects;
create policy "community_media_delete_own"
  on storage.objects for delete to authenticated
  using (bucket_id = 'community-media' and (storage.foldername(name))[2] = (select auth.uid())::text);

-- ---------------------------------------------------------------- community-images policies
drop policy if exists "community_images_insert_own_folder" on storage.objects;
create policy "community_images_insert_own_folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'community-images'
    and (select auth.uid()) is not null
    and array_length(storage.foldername(name), 1) = 1
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and storage.filename(name) ~ '^community-[0-9]{10,16}\.(jpg|png)$'
  );

drop policy if exists "community_images_delete_own_folder" on storage.objects;
create policy "community_images_delete_own_folder"
  on storage.objects for delete to authenticated
  using (bucket_id = 'community-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------- attachment checks
create or replace function public.validate_community_attachment()
returns trigger
language plpgsql
security definer          -- reads storage.objects regardless of the caller's RLS
set search_path = ''
as $$
declare
  obj record;
  prefix text := new.community_id::text || '/' || new.author_id::text || '/';
  mime text;
  bytes bigint;
begin
  if new.attachment_path is null then
    new.attachment_size := null;
    return new;
  end if;
  if left(new.attachment_path, length(prefix)) <> prefix
     or new.attachment_path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/(msg|content)-[0-9]{10,16}\.(jpg|png|pdf)$' then
    raise exception using errcode = '22023', message = 'GENZ_ATTACHMENT_PATH: upload the file to your own folder in this community first';
  end if;
  select o.metadata into obj from storage.objects o where o.bucket_id = 'community-media' and o.name = new.attachment_path;
  if not found then
    raise exception using errcode = '22023', message = 'GENZ_ATTACHMENT_NOT_FOUND: upload the file before attaching it';
  end if;
  mime := coalesce(obj.metadata ->> 'mimetype', '');
  bytes := coalesce(nullif(obj.metadata ->> 'size', '')::bigint, 0);
  if new.attachment_kind = 'image' then
    if mime not in ('image/jpeg', 'image/png') then
      raise exception using errcode = '22023', message = 'GENZ_ATTACHMENT_TYPE: photos must be JPEG or PNG';
    end if;
    if bytes > 5242880 then
      raise exception using errcode = '22023', message = 'GENZ_ATTACHMENT_TOO_LARGE: photos can be up to 5 MB';
    end if;
  elsif new.attachment_kind = 'pdf' then
    if mime <> 'application/pdf' then
      raise exception using errcode = '22023', message = 'GENZ_ATTACHMENT_TYPE: documents must be PDF';
    end if;
    if bytes > 10485760 then
      raise exception using errcode = '22023', message = 'GENZ_ATTACHMENT_TOO_LARGE: PDFs can be up to 10 MB';
    end if;
  end if;
  new.attachment_size := bytes;
  return new;
end;
$$;
revoke execute on function public.validate_community_attachment() from public, anon, authenticated;

create or replace trigger community_messages_attachment_check
  before insert on public.community_messages
  for each row execute function public.validate_community_attachment();
create or replace trigger community_content_attachment_check
  before insert on public.community_content
  for each row execute function public.validate_community_attachment();

-- Cover image: must exist in the setter's own folder of community-images.
create or replace function public.validate_community_image()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.image_path is not null and (tg_op = 'INSERT' or new.image_path is distinct from old.image_path) then
    if split_part(new.image_path, '/', 1) <> (select auth.uid())::text
       or not exists (select 1 from storage.objects o where o.bucket_id = 'community-images' and o.name = new.image_path) then
      raise exception using errcode = '22023', message = 'GENZ_IMAGE_NOT_FOUND: upload the image to your own folder before using it';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.validate_community_image() from public, anon, authenticated;

create or replace trigger communities_image_check
  before insert or update of image_path on public.communities
  for each row execute function public.validate_community_image();
