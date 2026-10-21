-- =============================================================================
-- Migration 20261021120100_visibility_helpers
-- Phase 3 · Step 2 of 10
-- =============================================================================
-- Creates : shared authorization helpers reused by EVERY rule that decides who
--           can see whom (spec §12 "reusable database authorization helpers …
--           so RLS rules remain consistent across posts, profiles, search"):
--             • public.is_blocked_between(a, b)
--             • public.can_see_profile(profile_id)          — identity: name, photo, bio
--             • public.can_view_author_content(author_id)   — posts, comments, likes
-- Changes : profile / profile-tag / badge read policies become block-aware.
-- Depends : 20261021120000_social_graph_tables.
-- Safe to re-run : yes.
-- Destructive    : no data touched. Re-creates three SELECT policies by name
--           (same names as before, so Phase 1/2 checks still find them).
-- Order   : if you ever re-run a Phase 1 or Phase 2 file, re-run this file
--           afterwards (those files recreate the policies without the block rule).
--
-- Rules (spec §11):
--   • Blocking (either direction) hides each person from the other entirely.
--   • A private profile's identity (name, photo, bio) stays visible to
--     non-followers; its posts are visible only to the owner and accepted
--     followers.
-- =============================================================================

create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer          -- blocks are private to the blocker; this reads both directions
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks bl
     where (bl.blocker_id = a and bl.blocked_id = b)
        or (bl.blocker_id = b and bl.blocked_id = a)
  );
$$;

-- Identity visibility for the CURRENT user (auth.uid()).
create or replace function public.can_see_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
     and (
       p_profile_id = (select auth.uid())
       or not public.is_blocked_between((select auth.uid()), p_profile_id)
     );
$$;

-- Content visibility for the CURRENT user: own content, or not blocked and
-- (author is public, or the viewer is an accepted follower).
create or replace function public.can_view_author_content(p_author_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
     and (
       p_author_id = (select auth.uid())
       or (
         not public.is_blocked_between((select auth.uid()), p_author_id)
         and (
           exists (select 1 from public.profiles p where p.id = p_author_id and not p.is_private)
           or exists (select 1 from public.follows f
                       where f.follower_id = (select auth.uid()) and f.following_id = p_author_id)
         )
       )
     );
$$;

comment on function public.is_blocked_between(uuid, uuid) is 'GenZ in Action: true if either user blocked the other.';
comment on function public.can_see_profile(uuid) is 'GenZ in Action: can the current user see this profile''s identity (not blocked either way)?';
comment on function public.can_view_author_content(uuid) is 'GenZ in Action: can the current user see this author''s posts/comments (own, or not blocked and public-or-followed)?';

-- RLS policies call can_see_profile / can_view_author_content as the requesting
-- user, so authenticated needs EXECUTE on those two. They only ever answer about
-- the caller's OWN relationship to a profile.
-- is_blocked_between takes two arbitrary ids, so it must NOT be callable through
-- the API: otherwise anyone could ask "did X block Y?" about two other people
-- (spec: blocked people "are not told they were blocked"). It is used only
-- inside SECURITY DEFINER functions, which run as the owner.
revoke execute on function public.is_blocked_between(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.can_see_profile(uuid) from public, anon;
revoke execute on function public.can_view_author_content(uuid) from public, anon;
grant execute on function public.can_see_profile(uuid) to authenticated;
grant execute on function public.can_view_author_content(uuid) to authenticated;

-- Profiles: hidden from blocked pairs (both directions). Same policy name as Phase 1.
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles for select to authenticated
  using (public.can_see_profile(id));

drop policy if exists "user_profile_tags_select_authenticated" on public.user_profile_tags;
create policy "user_profile_tags_select_authenticated"
  on public.user_profile_tags for select to authenticated
  using (public.can_see_profile(user_id));

drop policy if exists "user_badges_select_authenticated" on public.user_badges;
create policy "user_badges_select_authenticated"
  on public.user_badges for select to authenticated
  using (public.can_see_profile(user_id));
