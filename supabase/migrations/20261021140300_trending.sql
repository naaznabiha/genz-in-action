-- =============================================================================
-- Migration 20261021140300_trending
-- Phase 4 · Step 4 of 5
-- =============================================================================
-- Creates : public.get_trending_hashtags(limit) — "Trending" tags for Explore
--           and Home "Trending Right Now".
--           ("Top posts this week" is public.query_posts(p_mode => 'top_week').)
-- Depends : Phase 3 posts/post_hashtags/hashtags, 20261021140100_query_posts.
-- Safe to re-run : yes (CREATE OR REPLACE).
-- Destructive    : no.
-- Spec    : FR-13, §11 "Trending hashtags use a simple, documented MVP
--           heuristic based on recent post volume and engagement within a
--           rolling time window. The exact weights/window may be tuned later
--           without changing the core data model."
--
-- Rule (decision D39, approved 2026-10-21):
--   window  = posts published in the last 7 days (rolling)
--   score   = 3 × posts using the tag + 1 × their likes + 2 × their comments
--             (likes/comments = the trusted counters on those posts)
--   order   = score, then post count, then tag (stable)
--   count   = "N posts" shown in the app = posts in the window using the tag
-- Only posts the viewer may see are counted — the shared Phase 3 helper
-- public.can_view_author_content() (the posts RLS rule), applied once per
-- author — so private accounts' posts and blocked users never shape what you
-- see. SECURITY DEFINER only so that check is not repeated per post (under RLS
-- it ran on every post of the week, ~3 checks each); returns tags and totals only.
-- To tune: change the three weights / interval below in a new migration.
-- =============================================================================

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
    join public.profiles a on a.id = p.author_id
                          and public.can_view_author_content(a.id)   -- posts RLS rule
    join public.post_hashtags ph on ph.post_id = p.id
    join public.hashtags h on h.id = ph.hashtag_id
   where p.created_at > now() - interval '7 days'
   group by h.tag
   order by score desc, post_count desc, h.tag
   limit least(greatest(coalesce(p_limit, 10), 1), 30);
$$;

comment on function public.get_trending_hashtags(integer) is
  'GenZ in Action: trending tags, last 7 days, score = 3·posts + likes + 2·comments over posts the caller may see (D39).';

revoke execute on function public.get_trending_hashtags(integer) from public, anon;
grant execute on function public.get_trending_hashtags(integer) to authenticated;
