-- =============================================================================
-- Migration 20261021140100_query_posts
-- Phase 4 · Step 2 of 5
-- =============================================================================
-- Creates : • public.search_tsquery(text) — turns what a user typed into a
--             safe prefix tsquery ("clim jus" → 'clim':* & 'jus':*)
--           • public.query_posts(...) — ONE page of visible posts for every
--             post list in the app: feed, author, single post, category,
--             hashtag feed, text search, Featured Action and "top posts this
--             week". Same columns as get_posts; authors, photo path, counters
--             and the viewer's liked/saved state in the same request.
-- Changes : public.get_posts(...) keeps its exact signature and behaviour but
--           now delegates to query_posts (no duplicated query).
-- Depends : Phase 3 (posts, post_media, post_hashtags, hashtags, likes, saves),
--           20261021140000_search_indexes.
-- Safe to re-run : yes (CREATE OR REPLACE).
-- Destructive    : no.
-- Spec    : §13.1 (cursor pagination, no request per post, full-text search),
--           FR-13 hashtag feeds, FR-14 search, FR-25 Explore.
--
-- Visibility: every returned post passes the shared Phase 3 helper
-- public.can_view_author_content(author) — exactly the posts RLS rule — so
-- private accounts' posts (for non-followers) and blocked users' posts are
-- never returned (D29). The function is SECURITY DEFINER and applies that
-- helper explicitly on the author join instead of relying on RLS: under RLS,
-- Postgres must check visibility on EVERY post before it may use the full-text
-- index, which made search scale with the size of the table (measured: 230 ms
-- at 3,000 posts vs ~5 ms this way). Nothing else is read across users:
-- photos only of returned posts, likes/saves only the caller's own rows.
--
-- Ordering / cursors (keyset, never OFFSET):
--   latest, search, hashtag, category, author : (created_at, id) desc
--   top_week : (score, created_at, id) desc, score = like_count + 2 × comment_count,
--              posts created in the last 7 days (decision D39)
--   featured : Take Action posts with ≥1 like in the last 14 days, most liked
--              first (Phase 3 D28; first page only)
-- =============================================================================

create or replace function public.search_tsquery(p_text text)
returns tsquery
language sql
immutable
set search_path = ''
as $$
  -- Keep only letters/digits (any alphabet), max 8 words of ≤ 50 chars, each
  -- matched as a prefix. Input can never inject tsquery operators.
  select case when count(*) = 0 then null
              else to_tsquery('simple', string_agg(w || ':*', ' & ' order by ord)) end
    from (
      select left(m[1], 50) as w, ord
        from regexp_matches(lower(coalesce(p_text, '')), '([[:alnum:]]+)', 'g') with ordinality as r(m, ord)
       order by ord
       limit 8
    ) words;
$$;

comment on function public.search_tsquery(text) is
  'GenZ in Action: safe prefix tsquery from user input (letters/digits only, max 8 words).';

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
-- Plan every call with the real argument values, so the "(p_x is null or ...)"
-- branches fold away and the matching index is used (feed, category, author,
-- hashtag, search). A generic plan would scan and sort every visible post.
set plan_cache_mode = force_custom_plan
as $$
#variable_conflict use_column
declare
  -- Computed once, so the planner sees them as values (index on hashtags.tag,
  -- GIN on posts_search_idx) instead of evaluating them per post.
  v_tsq tsquery := public.search_tsquery(p_query);
  v_tag text    := nullif(lower(btrim(coalesce(p_hashtag, ''), '# ')), '');
begin
  return query
  select p.id, p.author_id, a.username, a.display_name, a.avatar_path,
         p.type, p.category, p.title, p.body, p.location, p.event_at,
         p.like_count, p.comment_count, p.created_at, p.updated_at,
         m.storage_path, m.width, m.height,
         exists (select 1 from public.post_likes l where l.post_id = p.id and l.user_id = (select auth.uid())),
         exists (select 1 from public.post_saves s where s.post_id = p.id and s.user_id = (select auth.uid())),
         (p.like_count + 2 * p.comment_count)
    from public.posts p
    join public.profiles a on a.id = p.author_id
                          and public.can_view_author_content(a.id)   -- the posts RLS rule (Phase 3)
    left join public.post_media m on m.post_id = p.id and m.position = 0
   where (p_post_id is null or p.id = p_post_id)
     and (p_author_id is null or p.author_id = p_author_id)
     and (p_category is null or p.category = p_category)
     -- text search: a query with no letters/digits matches nothing
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

comment on function public.query_posts(uuid, uuid, text, text, text, text, integer, timestamptz, uuid, integer) is
  'GenZ in Action: one keyset page of visible posts (feed/author/category/hashtag/search/featured/top_week) with author, photo, counters and viewer state.';

-- get_posts: unchanged contract (Phase 3 app calls), now a thin wrapper.
create or replace function public.get_posts(
  p_post_id        uuid default null,
  p_author_id      uuid default null,
  p_category       text default null,
  p_before_created timestamptz default null,
  p_before_id      uuid default null,
  p_limit          integer default 20,
  p_mode           text default 'latest'
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
  select q.id, q.author_id, q.author_username, q.author_display_name, q.author_avatar_path,
         q.type, q.category, q.title, q.body, q.location, q.event_at,
         q.like_count, q.comment_count, q.created_at, q.updated_at,
         q.media_path, q.media_width, q.media_height, q.liked_by_me, q.saved_by_me
    from public.query_posts(
           p_post_id => p_post_id, p_author_id => p_author_id, p_category => p_category,
           p_mode => case when p_mode = 'featured' then 'featured' else 'latest' end,
           p_before_created => p_before_created, p_before_id => p_before_id, p_limit => p_limit) q;
$$;

revoke execute on function public.search_tsquery(text) from public, anon;
grant execute on function public.search_tsquery(text) to authenticated;
revoke execute on function public.query_posts(uuid, uuid, text, text, text, text, integer, timestamptz, uuid, integer) from public, anon;
grant execute on function public.query_posts(uuid, uuid, text, text, text, text, integer, timestamptz, uuid, integer) to authenticated;
revoke execute on function public.get_posts(uuid, uuid, text, timestamptz, uuid, integer, text) from public, anon;
grant execute on function public.get_posts(uuid, uuid, text, timestamptz, uuid, integer, text) to authenticated;
