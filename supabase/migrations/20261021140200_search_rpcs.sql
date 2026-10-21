-- =============================================================================
-- Migration 20261021140200_search_rpcs
-- Phase 4 · Step 3 of 5
-- =============================================================================
-- Creates : • public.search_profiles(query, limit, cursor) — people search
--           • public.search_hashtags(query, limit, cursor) — hashtag search
--           • public.get_hashtag(tag) — hashtag feed header (visible post count)
--           Post search is public.query_posts(p_query => …) (previous migration).
-- Depends : 20261021140000_search_indexes, 20261021140100_query_posts, Phase 3.
-- Safe to re-run : yes (CREATE OR REPLACE).
-- Destructive    : no.
-- Spec    : FR-14 (search profiles, posts, hashtags), §13.1, §11 blocks.
--
-- Visibility uses the shared Phase 3 helpers, applied explicitly:
--   • profiles: public.can_see_profile(id) — exactly the profiles RLS rule.
--     Anyone who blocked you, or whom you blocked, never appears. Private
--     accounts DO appear (identity is public, decision D29); their posts do not.
--   • hashtags / counts: only posts passing public.can_view_author_content()
--     (the posts RLS rule) count, and a tag with no such post is not returned
--     (same as the hashtags RLS rule, D36) — so private or blocked posts never
--     show up as results or inflate numbers.
-- The functions are SECURITY DEFINER so the indexes below can be used first
-- and the helper runs only on matching rows. (Under RLS, Postgres must run the
-- visibility check on every row before it may use a full-text index — search
-- time then grows with the whole table.) They return only the columns listed.
--
-- Profile ranking: 0 = exact username, 1 = username starts with the query,
-- 2 = any word of username / display name starts with each query word.
-- Keyset cursor (rank, username) — no OFFSET.
-- Hashtags: prefix match on the tag (a leading # is ignored), alphabetical, so
-- an exact match comes first. Keyset cursor (tag).
-- =============================================================================

-- Follower counts need rows the caller cannot read (follows RLS), so an
-- invoker query would under-count. This tiny definer helper returns only the
-- number (0 across a block), never the rows.
create or replace function public.follower_count(p_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.follows f
   where f.following_id = p_user_id
     and public.can_see_profile(p_user_id);
$$;

comment on function public.follower_count(uuid) is
  'GenZ in Action: follower count of a profile the caller may see (0 across a block).';

create or replace function public.search_profiles(
  p_query       text,
  p_limit       integer default 20,
  p_after_rank  integer default null,
  p_after_name  text    default null
)
returns table (
  id             uuid,
  username       text,
  display_name   text,
  avatar_path    text,
  is_private     boolean,
  follower_count integer,
  relationship   text,
  match_rank     integer
)
language plpgsql
stable
security definer
set search_path = ''
set plan_cache_mode = force_custom_plan   -- plan with the real values (index use)
as $$
#variable_conflict use_column
declare
  v_raw    text    := lower(btrim(coalesce(p_query, ''), ' @'));
  v_tsq    tsquery := public.search_tsquery(btrim(coalesce(p_query, ''), ' @'));
  v_prefix text;
begin
  if v_tsq is null then
    return;                                   -- nothing searchable typed
  end if;
  -- LIKE pattern for "username starts with", with % _ \ taken literally
  v_prefix := replace(replace(replace(v_raw, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  return query
  with hits as (
    select p.id, p.username, p.display_name, p.avatar_path, p.is_private,
           case
             when lower(p.username) = v_raw then 0
             when lower(p.username) like v_prefix then 1
             else 2
           end as match_rank
      from public.profiles p
     where (to_tsvector('simple', p.username || ' ' || p.display_name) @@ v_tsq
            or lower(p.username) like v_prefix)
       and public.can_see_profile(p.id)        -- the profiles RLS rule (Phase 3)
  )
  select h.id, h.username, h.display_name, h.avatar_path, h.is_private,
         public.follower_count(h.id),
         public.relationship_with(h.id),
         h.match_rank
    from hits h
   where p_after_rank is null
      or (h.match_rank, h.username) > (p_after_rank, coalesce(p_after_name, ''))
   order by h.match_rank, h.username
   limit least(greatest(coalesce(p_limit, 20), 1), 50);
end;
$$;

comment on function public.search_profiles(text, integer, integer, text) is
  'GenZ in Action: people search (exact username, username prefix, then name words) over profiles the caller may see; keyset cursor (match_rank, username).';

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
  -- tags are stored lowercase [a-z0-9_]; anything else typed (#, spaces) is dropped
  v_prefix text := lower(regexp_replace(coalesce(p_query, ''), '[^A-Za-z0-9_]', '', 'g'));
begin
  if v_prefix = '' then
    return;
  end if;
  return query
  with tags as (                              -- candidate tags, by the prefix index
    select h.id, h.tag
      from public.hashtags h
     where h.tag like replace(v_prefix, '_', '\_') || '%'
       and (p_after_tag is null or h.tag > p_after_tag)
  ),
  counts as (                                 -- visible posts per candidate tag
    select ph.hashtag_id, count(*)::integer as n
      from public.post_hashtags ph
      join public.posts p on p.id = ph.post_id
      join public.profiles a on a.id = p.author_id
                            and public.can_view_author_content(a.id)   -- posts RLS rule
     where ph.hashtag_id in (select t.id from tags t)
     group by ph.hashtag_id
  )
  select t.tag, c.n                           -- inner join: no visible post → not shown (D36)
    from tags t
    join counts c on c.hashtag_id = t.id
   order by t.tag
   limit least(greatest(coalesce(p_limit, 20), 1), 50);
end;
$$;

comment on function public.search_hashtags(text, integer, text) is
  'GenZ in Action: hashtags starting with the query, with the number of posts the caller may see (tags with none are hidden); keyset cursor (tag).';

-- Header of a hashtag feed. No row when the tag has no post the caller may see.
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
        join public.profiles a on a.id = p.author_id
                              and public.can_view_author_content(a.id)   -- posts RLS rule
       where ph.hashtag_id = h.id
    ) c
   where h.tag = lower(btrim(coalesce(p_tag, ''), '# '))
     and c.n > 0;
$$;

comment on function public.get_hashtag(text) is
  'GenZ in Action: a hashtag and the number of its posts the caller may see (no row if none are visible).';

revoke execute on function public.search_profiles(text, integer, integer, text) from public, anon;
revoke execute on function public.follower_count(uuid) from public, anon;
revoke execute on function public.search_hashtags(text, integer, text) from public, anon;
revoke execute on function public.get_hashtag(text) from public, anon;
grant execute on function public.search_profiles(text, integer, integer, text) to authenticated;
grant execute on function public.follower_count(uuid) to authenticated;
grant execute on function public.search_hashtags(text, integer, text) to authenticated;
grant execute on function public.get_hashtag(text) to authenticated;
