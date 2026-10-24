-- =============================================================================
-- Migration 20261024100200_saved_liked_posts
-- Phase 5 · Step 3 of 4
-- =============================================================================
-- Creates : public.get_my_post_list(list, cursor, limit) — the Saved tab's
--           "Saved" and "Liked" lists: one keyset page of the posts YOU saved
--           or liked, most recently saved/liked first, with the same columns
--           as get_posts plus `listed_at` (when you saved/liked it).
-- Depends : Phase 3 post_saves, post_likes, posts, post_media, profiles;
--           Phase 4 decision D41 (explicit visibility helper).
-- Safe to re-run : yes (CREATE OR REPLACE).
-- Destructive    : no.
-- Spec    : FR-19 saved posts, FR-09 likes, §13.1 cursor pagination.
--
-- Only the caller's own saves/likes are read. A post is returned only while
-- the caller may still see it (the Phase 3 helper can_view_author_content())
-- — so posts that were deleted (cascade), whose author went private (and you
-- don't follow), or who blocked you either way drop out automatically; they
-- come back if they become visible again. SECURITY DEFINER like the Phase 4
-- readers (D41) so the per-user index is used before the visibility check.
-- Cursor: (listed_at, post id), newest first — no OFFSET.
-- =============================================================================

create or replace function public.get_my_post_list(
  p_list        text,                       -- 'saved' | 'liked'
  p_before_at   timestamptz default null,
  p_before_id   uuid        default null,
  p_limit       integer     default 20
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
  saved_by_me         boolean,
  listed_at           timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
set plan_cache_mode = force_custom_plan
as $$
#variable_conflict use_column
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception using errcode = '42501', message = 'Not signed in';
  end if;
  if p_list is null or p_list not in ('saved', 'liked') then
    raise exception using errcode = '22023', message = 'list must be saved or liked';
  end if;

  return query
  with mine as (
    select s.post_id, s.created_at as listed_at from public.post_saves s
     where p_list = 'saved' and s.user_id = uid
    union all
    select l.post_id, l.created_at from public.post_likes l
     where p_list = 'liked' and l.user_id = uid
  )
  select p.id, p.author_id, a.username, a.display_name, a.avatar_path,
         p.type, p.category, p.title, p.body, p.location, p.event_at,
         p.like_count, p.comment_count, p.created_at, p.updated_at,
         m2.storage_path, m2.width, m2.height,
         exists (select 1 from public.post_likes l where l.post_id = p.id and l.user_id = uid),
         exists (select 1 from public.post_saves s where s.post_id = p.id and s.user_id = uid),
         m.listed_at
    from mine m
    join public.posts p on p.id = m.post_id
    join public.profiles a on a.id = p.author_id
                          and public.can_view_author_content(a.id)   -- the posts RLS rule (Phase 3)
    left join public.post_media m2 on m2.post_id = p.id and m2.position = 0
   where p_before_at is null
      or (m.listed_at, m.post_id) < (p_before_at, coalesce(p_before_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))
   order by m.listed_at desc, m.post_id desc
   limit least(greatest(coalesce(p_limit, 20), 1), 50);
end;
$$;

comment on function public.get_my_post_list(text, timestamptz, uuid, integer) is
  'GenZ in Action: the caller''s saved or liked posts they may still see, most recent first; keyset cursor (listed_at, post id).';

revoke execute on function public.get_my_post_list(text, timestamptz, uuid, integer) from public, anon;
grant execute on function public.get_my_post_list(text, timestamptz, uuid, integer) to authenticated;
