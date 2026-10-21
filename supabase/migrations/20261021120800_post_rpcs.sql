-- =============================================================================
-- Migration 20261021120800_post_rpcs
-- Phase 3 · Step 9 of 10
-- =============================================================================
-- Creates : • public.create_post(...)  — post + optional photo in one transaction
--           • public.update_post(...)  — edit content and photo in one transaction
--           • public.get_posts(...)    — feed / user posts / single post / featured,
--             each page in ONE request with author identity, photo path,
--             counters and the viewer's liked/saved state (spec §13.1: no
--             request per post; cursor pagination on created_at + id).
-- Depends : 20261021120200 … 20261021120700.
-- Safe to re-run : yes (CREATE OR REPLACE).
-- Destructive    : no.
--
-- All three are SECURITY INVOKER: they run as the signed-in user, so every
-- RLS rule (visibility, blocks, private accounts, authorship), column grant and
-- CHECK constraint still applies. They add convenience and atomicity, not power.
-- =============================================================================

create or replace function public.create_post(
  p_type         text,
  p_category     text,
  p_title        text,
  p_body         text,
  p_location     text,
  p_event_at     timestamptz,
  p_media_path   text,
  p_media_width  integer,
  p_media_height integer
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid    uuid := auth.uid();
  new_id uuid;
begin
  if uid is null then
    raise exception using errcode = '42501', message = 'GENZ_NOT_SIGNED_IN: sign in to post';
  end if;

  insert into public.posts (author_id, type, category, title, body, location, event_at)
  values (
    uid,
    p_type,
    p_category,
    btrim(coalesce(p_title, '')),
    btrim(coalesce(p_body, '')),
    nullif(btrim(coalesce(p_location, '')), ''),
    case when p_type = 'event' then p_event_at else null end
  )
  returning id into new_id;

  if nullif(btrim(coalesce(p_media_path, '')), '') is not null then
    insert into public.post_media (post_id, storage_path, width, height)
    values (new_id, btrim(p_media_path), p_media_width, p_media_height);
  end if;

  return new_id;
end;
$$;

-- Returns the storage path of a photo that is no longer used (replaced or
-- removed), so the app can delete the file via the Storage API; else null.
create or replace function public.update_post(
  p_post_id      uuid,
  p_type         text,
  p_category     text,
  p_title        text,
  p_body         text,
  p_location     text,
  p_event_at     timestamptz,
  p_media_path   text,
  p_media_width  integer,
  p_media_height integer
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid      uuid := auth.uid();
  old_path text;
  new_path text := nullif(btrim(coalesce(p_media_path, '')), '');
begin
  if uid is null then
    raise exception using errcode = '42501', message = 'GENZ_NOT_SIGNED_IN: sign in to edit';
  end if;

  update public.posts
     set type     = p_type,
         category = p_category,
         title    = btrim(coalesce(p_title, '')),
         body     = btrim(coalesce(p_body, '')),
         location = nullif(btrim(coalesce(p_location, '')), ''),
         event_at = case when p_type = 'event' then p_event_at else null end
   where id = p_post_id and author_id = uid;

  if not found then
    raise exception using errcode = '42501', message = 'GENZ_NOT_YOUR_POST: you can only edit your own posts';
  end if;

  select pm.storage_path into old_path from public.post_media pm where pm.post_id = p_post_id;

  if old_path is distinct from new_path then
    delete from public.post_media where post_id = p_post_id;
    if new_path is not null then
      insert into public.post_media (post_id, storage_path, width, height)
      values (p_post_id, new_path, p_media_width, p_media_height);
    end if;
    return old_path;
  end if;
  return null;
end;
$$;

create or replace function public.get_posts(
  p_post_id        uuid default null,
  p_author_id      uuid default null,
  p_category       text default null,
  p_before_created timestamptz default null,
  p_before_id      uuid default null,
  p_limit          integer default 20,
  p_mode           text default 'latest'     -- 'latest' | 'featured'
)
returns table (
  id                  uuid,
  author_id           uuid,
  author_username     text,
  author_display_name text,
  author_avatar_path  text,
  type                text,
  category            text,
  title               text,
  body                text,
  location            text,
  event_at            timestamptz,
  like_count          integer,
  comment_count       integer,
  created_at          timestamptz,
  updated_at          timestamptz,
  media_path          text,
  media_width         integer,
  media_height        integer,
  liked_by_me         boolean,
  saved_by_me         boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.id, p.author_id, a.username, a.display_name, a.avatar_path,
         p.type, p.category, p.title, p.body, p.location, p.event_at,
         p.like_count, p.comment_count, p.created_at, p.updated_at,
         m.storage_path, m.width, m.height,
         exists (select 1 from public.post_likes l where l.post_id = p.id and l.user_id = (select auth.uid())),
         exists (select 1 from public.post_saves s where s.post_id = p.id and s.user_id = (select auth.uid()))
    from public.posts p
    join public.profiles a on a.id = p.author_id          -- RLS: blocked authors drop out
    left join public.post_media m on m.post_id = p.id and m.position = 0
   where (p_post_id is null or p.id = p_post_id)
     and (p_author_id is null or p.author_id = p_author_id)
     and (p_category is null or p.category = p_category)
     and (p_before_created is null or (p.created_at, p.id) < (p_before_created, coalesce(p_before_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
     and (p_mode <> 'featured' or (p.type = 'action' and p.like_count > 0 and p.created_at > now() - interval '14 days'))
   order by
     case when p_mode = 'featured' then p.like_count end desc nulls last,
     p.created_at desc, p.id desc
   limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

comment on function public.create_post(text, text, text, text, text, timestamptz, text, integer, integer) is
  'GenZ in Action: creates the caller''s post and optional photo atomically (SECURITY INVOKER).';
comment on function public.update_post(uuid, text, text, text, text, text, timestamptz, text, integer, integer) is
  'GenZ in Action: edits the caller''s post and photo atomically; returns a no-longer-used photo path.';
comment on function public.get_posts(uuid, uuid, text, timestamptz, uuid, integer, text) is
  'GenZ in Action: one page of visible posts with author, photo, counters and viewer state (cursor: created_at,id).';

revoke execute on function public.create_post(text, text, text, text, text, timestamptz, text, integer, integer) from public, anon;
revoke execute on function public.update_post(uuid, text, text, text, text, text, timestamptz, text, integer, integer) from public, anon;
revoke execute on function public.get_posts(uuid, uuid, text, timestamptz, uuid, integer, text) from public, anon;
grant execute on function public.create_post(text, text, text, text, text, timestamptz, text, integer, integer) to authenticated;
grant execute on function public.update_post(uuid, text, text, text, text, text, timestamptz, text, integer, integer) to authenticated;
grant execute on function public.get_posts(uuid, uuid, text, timestamptz, uuid, integer, text) to authenticated;
