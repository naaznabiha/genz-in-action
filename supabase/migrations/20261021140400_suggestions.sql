-- =============================================================================
-- Migration 20261021140400_suggestions
-- Phase 4 · Step 5 of 5
-- =============================================================================
-- Creates : public.get_people_suggestions(limit, cursor) — Explore "People"
--           (paginated) and the ranking behind Home "People to Follow".
-- Changes : public.get_suggested_people(limit) keeps its signature and columns
--           (Phase 3 app) but now returns the same ranking.
-- Depends : Phase 2 user_profile_tags, Phase 3 follows/follow_requests/blocks.
-- Safe to re-run : yes (CREATE OR REPLACE).
-- Destructive    : no.
-- Spec    : FR-12, FR-25 "People".
--
-- Ranking (decision D40, approved 2026-10-21), highest first:
--   1. shared profile tags with you (causes you both picked)
--   2. network: how many people you follow follow them
--   3. popularity: follower count
--   then id (stable order for the cursor).
-- Always excluded: yourself, people you follow, people you have requested,
-- and anyone blocked in either direction. Private accounts can be suggested
-- (identity is public, D29); following them sends a request.
-- SECURITY DEFINER because ranking needs follow rows the caller cannot read;
-- it returns only the suggested people, a shared-tag count and the follower
-- count — never who follows whom.
-- Keyset cursor: (rank_key, id) where rank_key packs the three scores.
-- =============================================================================

create or replace function public.get_people_suggestions(
  p_limit     integer default 20,
  p_after_key bigint  default null,
  p_after_id  uuid    default null
)
returns table (
  id               uuid,
  username         text,
  display_name     text,
  avatar_path      text,
  is_private       boolean,
  follower_count   integer,
  shared_tag_count integer,
  rank_key         bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select (select auth.uid()) as uid),
  candidates as (
    select p.id, p.username, p.display_name, p.avatar_path, p.is_private, p.created_at,
           (select count(*)::integer from public.follows f where f.following_id = p.id) as followers,
           (select count(*)::integer
              from public.user_profile_tags t
              join public.user_profile_tags mine on mine.tag_id = t.tag_id and mine.user_id = me.uid
             where t.user_id = p.id) as shared,
           (select count(*)::integer
              from public.follows theirs
              join public.follows mine on mine.following_id = theirs.follower_id and mine.follower_id = me.uid
             where theirs.following_id = p.id) as network
      from me
      join public.profiles p on p.id <> me.uid
     where me.uid is not null
       and not public.is_blocked_between(me.uid, p.id)
       and not exists (select 1 from public.follows f where f.follower_id = me.uid and f.following_id = p.id)
       and not exists (select 1 from public.follow_requests r where r.requester_id = me.uid and r.target_id = p.id)
  ),
  ranked as (
    select c.*,
           (least(c.shared, 999)::bigint * 1000000000000
            + least(c.network, 999999)::bigint * 1000000
            + least(c.followers, 999999)::bigint) as rk
      from candidates c
  )
  select r.id, r.username, r.display_name, r.avatar_path, r.is_private, r.followers, r.shared, r.rk
    from ranked r
   where p_after_key is null
      or (r.rk, r.id) < (p_after_key, coalesce(p_after_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))
   order by r.rk desc, r.id desc
   limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

comment on function public.get_people_suggestions(integer, bigint, uuid) is
  'GenZ in Action: people to follow — shared tags, then network, then popularity (D40); excludes self/followed/requested/blocked; keyset cursor (rank_key, id).';

-- Home "People to Follow": same ranking, Phase 3 columns and signature.
create or replace function public.get_suggested_people(p_limit integer default 6)
returns table (id uuid, username text, display_name text, avatar_path text, is_private boolean, follower_count integer)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.username, s.display_name, s.avatar_path, s.is_private, s.follower_count
    from public.get_people_suggestions(least(greatest(coalesce(p_limit, 6), 1), 20)) s;
$$;

revoke execute on function public.get_people_suggestions(integer, bigint, uuid) from public, anon;
grant execute on function public.get_people_suggestions(integer, bigint, uuid) to authenticated;
revoke execute on function public.get_suggested_people(integer) from public, anon;
grant execute on function public.get_suggested_people(integer) to authenticated;
