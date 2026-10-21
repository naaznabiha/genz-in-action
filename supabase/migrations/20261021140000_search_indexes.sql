-- =============================================================================
-- Migration 20261021140000_search_indexes
-- Phase 4 · Step 1 of 5
-- =============================================================================
-- Creates : • full-text index on profile username + display name
--           • prefix index on lower(username) (exact / "starts with" matches)
--           • prefix index on hashtags.tag
--           (post title + body already has posts_search_idx from Phase 3)
-- Depends : Phase 1 profiles, Phase 3 hashtags/posts.
-- Safe to re-run : yes (IF NOT EXISTS).
-- Destructive    : no.
-- Spec    : §13.1 "Use PostgreSQL full-text search with appropriate indexes
--           for MVP profile/post/hashtag search. A dedicated search service is
--           not required initially." §15 M7.
--
-- Text configuration is 'simple' everywhere (no stemming, no stop words): it
-- works for any language and keeps names and hashtags intact. The search
-- functions (next migrations) MUST use exactly these expressions so the
-- planner can use the indexes.
-- =============================================================================

create index if not exists profiles_search_idx
  on public.profiles using gin (to_tsvector('simple', username || ' ' || display_name));

create index if not exists profiles_username_prefix_idx
  on public.profiles (lower(username) text_pattern_ops);

create index if not exists hashtags_tag_prefix_idx
  on public.hashtags (tag text_pattern_ops);
