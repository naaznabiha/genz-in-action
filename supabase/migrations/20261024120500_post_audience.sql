-- =============================================================================
-- Migration 20261024120500_post_audience
-- Phase 6 · Step 6 of 8
-- =============================================================================
-- Creates : public.create_community_post(community, …) — publish a post to one
--           community you belong to (Create → "Who is this post for?").
-- Changes : the post readers keep their exact arguments and columns but apply
--           the community-aware rule (can_view_post, D51):
--             query_posts, search_hashtags, get_hashtag, get_trending_hashtags,
--             get_my_post_list
--           and the general lists (Home, Explore category, Featured, Top
--           Actions This Week) show community posts only from communities you
--           are an active member of. Search, hashtag feeds, profiles and a
--           post's own page show every post you may see.
-- Depends : 20261024120100_community_access, Phase 4 + Phase 5 readers.
-- Safe to re-run : yes (CREATE OR REPLACE, same signatures).
-- Destructive    : no.
-- Order   : these functions were first created in Phase 4/5 files. If you ever
--           re-run one of those files, re-run THIS file after it — otherwise the
--           old body would ignore community privacy (98_verify_phase6 catches it).
--
-- Implementation note (D41 kept): each reader checks the shared helpers once
-- per AUTHOR (can_view_author_content, can_see_profile) and once per COMMUNITY
-- (can_read_community) through left joins, instead of once per post:
--   visible = (no community and author visible)
--          or (community and (you wrote it or (not blocked and you can read the community)))
-- which is exactly can_view_post(author, community).
-- =============================================================================

create or replace function public.create_community_post(
  p_community_id uuid,
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
security invoker            -- posts RLS: you must be an active member of the community
set search_path = ''
as $$
declare
  uid    uuid := auth.uid();
  new_id uuid;
begin
  if uid is null then
    raise exception using errcode = '42501', message = 'GENZ_NOT_SIGNED_IN: sign in to post';
  end if;
  if p_community_id is null or public.community_role(p_community_id) is null then
    raise exception using errcode = '42501', message = 'GENZ_NOT_A_MEMBER: join the community to post in it';
  end if;

  -- Same fields and rules as create_post (Phase 3), plus the audience.
  insert into public.posts (author_id, community_id, type, category, title, body, location, event_at)
  values (
    uid,
    p_community_id,
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
revoke execute on function public.create_community_post(uuid, text, text, text, text, text, timestamptz, text, integer, integer) from public, anon;
grant execute on function public.create_community_post(uuid, text, text, text, text, text, timestamptz, text, integer, integer) to authenticated;

-- ---------------------------------------------------------------- query_posts (same contract as Phase 4)
create or replace function public.query_posts(
  p_post_id        uuid        default null,
  p_author_id      uuid        default null,
  p_category       text        default null,
  p_hashtag        text        default null,
  p_query          text        default null,
  p_mode           text        default 'latest',   -- latest | featured | top_week
  p_before_score   integer     default null,
  p_before_created timestamptz default null,
  p_before_id      uuid        default null,
  p_limit          integer     default 20
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
  score               integer
)
language plpgsql
stable
security definer
set search_path = ''
set plan_cache_mode = force_custom_plan
as $$
#variable_conflict use_column
declare
  uid   uuid    := (select auth.uid());
  v_tsq tsquery := public.search_tsquery(p_query);
  v_tag text    := nullif(lower(btrim(coalesce(p_hashtag, ''), '# ')), '');
  -- a general list (Home, Explore category, Featured, Top this week): community
  -- posts only from your own communities
  v_general boolean := p_post_id is null and p_author_id is null and p_query is null and v_tag is null;
begin
  return query
  select p.id, p.author_id, a.username, a.display_name, a.avatar_path,
         p.type, p.category, p.title, p.body, p.location, p.event_at,
         p.like_count, p.comment_count, p.created_at, p.updated_at,
         m.storage_path, m.width, m.height,
         exists (select 1 from public.post_likes l where l.post_id = p.id and l.user_id = uid),
         exists (select 1 from public.post_saves s where s.post_id = p.id and s.user_id = uid),
         (p.like_count + 2 * p.comment_count)
    from public.posts p
    join public.profiles a on a.id = p.author_id
    left join public.profiles va on va.id = p.author_id and public.can_view_author_content(va.id)
    left join public.profiles ba on ba.id = p.author_id and public.can_see_profile(ba.id)
    left join public.communities rc on rc.id = p.community_id and public.can_read_community(rc.id)
    left join public.community_members mm on mm.community_id = p.community_id and mm.user_id = uid and mm.status = 'active'
    left join public.post_media m on m.post_id = p.id and m.position = 0
   where ((p.community_id is null and va.id is not null)
          or (p.community_id is not null and (p.author_id = uid or (ba.id is not null and rc.id is not null))))   -- can_view_post
     and (p.community_id is null or not v_general or mm.user_id is not null or p.author_id = uid)
     and (p_post_id is null or p.id = p_post_id)
     and (p_author_id is null or p.author_id = p_author_id)
     and (p_category is null or p.category = p_category)
     and (p_query is null or (v_tsq is not null
          and to_tsvector('simple', p.title || ' ' || p.body) @@ v_tsq))
     and (v_tag is null or p.id in (
          select ph.post_id from public.post_hashtags ph join public.hashtags h on h.id = ph.hashtag_id
           where h.tag = v_tag))
     and case p_mode
           when 'featured' then p.type = 'action' and p.like_count > 0 and p.created_at > now() - interval '14 days'
           when 'top_week' then p.created_at > now() - interval '7 days'
           else true
         end
     and case
           when p_before_created is null then true
           when p_mode = 'top_week' then
             ((p.like_count + 2 * p.comment_count), p.created_at, p.id)
               < (coalesce(p_before_score, 2147483647), p_before_created,
                  coalesce(p_before_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))
           else (p.created_at, p.id) < (p_before_created, coalesce(p_before_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))
         end
   order by
     case when p_mode = 'featured' then p.like_count end desc nulls last,
     case when p_mode = 'top_week' then (p.like_count + 2 * p.comment_count) end desc nulls last,
     p.created_at desc, p.id desc
   limit least(greatest(coalesce(p_limit, 20), 1), 50);
end;
$$;

-- ---------------------------------------------------------------- hashtag search / header (same contracts as Phase 4)
create or replace function public.search_hashtags(
  p_query     text,
  p_limit     integer default 20,
  p_after_tag text    default null
)
returns table (tag text, post_count integer)
language plpgsql
stable
security definer
set search_path = ''
set plan_cache_mode = force_custom_plan
as $$
#variable_conflict use_column
declare
  uid uuid := (select auth.uid());
  v_prefix text := lower(regexp_replace(coalesce(p_query, ''), '[^A-Za-z0-9_]', '', 'g'));
begin
  if v_prefix = '' then
    return;
  end if;
  return query
  with tags as (
    select h.id, h.tag
      from public.hashtags h
     where h.tag like replace(v_prefix, '_', '\_') || '%'
       and (p_after_tag is null or h.tag > p_after_tag)
  ),
  counts as (
    select ph.hashtag_id, count(*)::integer as n
      from public.post_hashtags ph
      join public.posts p on p.id = ph.post_id
      left join public.profiles va on va.id = p.author_id and public.can_view_author_content(va.id)
      left join public.profiles ba on ba.id = p.author_id and public.can_see_profile(ba.id)
      left join public.communities rc on rc.id = p.community_id and public.can_read_community(rc.id)
     where ph.hashtag_id in (select t.id from tags t)
       and ((p.community_id is null and va.id is not null)
            or (p.community_id is not null and (p.author_id = uid or (ba.id is not null and rc.id is not null))))
     group by ph.hashtag_id
  )
  select t.tag, c.n
    from tags t
    join counts c on c.hashtag_id = t.id
   order by t.tag
   limit least(greatest(coalesce(p_limit, 20), 1), 50);
end;
$$;

create or replace function public.get_hashtag(p_tag text)
returns table (tag text, post_count integer)
language sql
stable
security definer
set search_path = ''
as $$
  select h.tag, c.n
    from public.hashtags h
    cross join lateral (
      select count(*)::integer as n
        from public.post_hashtags ph
        join public.posts p on p.id = ph.post_id
        left join public.profiles va on va.id = p.author_id and public.can_view_author_content(va.id)
        left join public.profiles ba on ba.id = p.author_id and public.can_see_profile(ba.id)
        left join public.communities rc on rc.id = p.community_id and public.can_read_community(rc.id)
       where ph.hashtag_id = h.id
         and ((p.community_id is null and va.id is not null)
              or (p.community_id is not null and (p.author_id = (select auth.uid()) or (ba.id is not null and rc.id is not null))))
    ) c
   where h.tag = lower(btrim(coalesce(p_tag, ''), '# '))
     and c.n > 0;
$$;

-- ---------------------------------------------------------------- trending (same contract and rule D39)
create or replace function public.get_trending_hashtags(p_limit integer default 10)
returns table (tag text, post_count integer, like_count integer, comment_count integer, score integer)
language sql
stable
security definer
set search_path = ''
as $$
  select h.tag,
         count(*)::integer                                      as post_count,
         coalesce(sum(p.like_count), 0)::integer                 as like_count,
         coalesce(sum(p.comment_count), 0)::integer              as comment_count,
         (3 * count(*) + coalesce(sum(p.like_count), 0) + 2 * coalesce(sum(p.comment_count), 0))::integer as score
    from public.posts p
    left join public.profiles va on va.id = p.author_id and public.can_view_author_content(va.id)
    left join public.profiles ba on ba.id = p.author_id and public.can_see_profile(ba.id)
    left join public.communities rc on rc.id = p.community_id and public.can_read_community(rc.id)
    join public.post_hashtags ph on ph.post_id = p.id
    join public.hashtags h on h.id = ph.hashtag_id
   where p.created_at > now() - interval '7 days'
     and ((p.community_id is null and va.id is not null)
          or (p.community_id is not null and (p.author_id = (select auth.uid()) or (ba.id is not null and rc.id is not null))))
   group by h.tag
   order by score desc, post_count desc, h.tag
   limit least(greatest(coalesce(p_limit, 10), 1), 30);
$$;

-- ---------------------------------------------------------------- Saved / Liked (same contract as Phase 5)
create or replace function public.get_my_post_list(
  p_list        text,
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
    left join public.profiles va on va.id = p.author_id and public.can_view_author_content(va.id)
    left join public.profiles ba on ba.id = p.author_id and public.can_see_profile(ba.id)
    left join public.communities rc on rc.id = p.community_id and public.can_read_community(rc.id)
    left join public.post_media m2 on m2.post_id = p.id and m2.position = 0
   where ((p.community_id is null and va.id is not null)
          or (p.community_id is not null and (p.author_id = uid or (ba.id is not null and rc.id is not null))))
     and (p_before_at is null
          or (m.listed_at, m.post_id) < (p_before_at, coalesce(p_before_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
   order by m.listed_at desc, m.post_id desc
   limit least(greatest(coalesce(p_limit, 20), 1), 50);
end;
$$;
