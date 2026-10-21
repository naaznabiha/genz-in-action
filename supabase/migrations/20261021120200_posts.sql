-- =============================================================================
-- Migration 20261021120200_posts
-- Phase 3 · Step 3 of 10
-- =============================================================================
-- Creates : public.posts + edited-timestamp trigger, indexes, column grants, RLS.
-- Depends : 20261021120100_visibility_helpers, Phase 2 profile_tags (category).
-- Safe to re-run : yes.
-- Destructive    : no.
-- Spec    : §10 posts, §11 (authorship, Edited state, single audience),
--           FR-08, decision D24 (post fields).
--
-- Fields (D24): type (label only: action / event / petition / story),
-- category (one of the cause tags), title 10–100, body 30–2000 (prototype
-- minimums), optional location ≤80, optional event date (Events only).
-- No petition goal; no sign / RSVP / take-action features (D25).
--
-- "Edited" (spec §11): updated_at changes ONLY when content changes (trigger
-- below), never when counters change, so the app shows "Edited" exactly when
-- updated_at > created_at.
-- Counters like_count / comment_count are maintained by database triggers
-- (20261021120500) and cannot be written by the app (column grants).
-- Authored content: author FK is ON DELETE RESTRICT on purpose: account
-- deletion must handle posts explicitly (spec §11 deletion baseline), so a
-- user with posts cannot be silently cascaded away.
-- =============================================================================

create table if not exists public.posts (
  id            uuid primary key default gen_random_uuid(),
  author_id     uuid not null references public.profiles (id) on delete restrict,
  type          text not null default 'story'
                constraint posts_type_valid check (type in ('action', 'event', 'petition', 'story')),
  category      text not null references public.profile_tags (id) on delete restrict,
  title         text not null
                constraint posts_title_length check (char_length(btrim(title)) between 10 and 100),
  body          text not null
                constraint posts_body_length check (char_length(btrim(body)) between 30 and 2000),
  location      text
                constraint posts_location_length check (location is null or char_length(btrim(location)) between 1 and 80),
  event_at      timestamptz
                constraint posts_event_at_only_events check (event_at is null or type = 'event'),
  -- Spec §10/§11: one audience per post. Communities (later phase) will extend
  -- this check and add community_id.
  audience_type text not null default 'public'
                constraint posts_audience_valid check (audience_type in ('public')),
  like_count    integer not null default 0 constraint posts_like_count_nonneg check (like_count >= 0),
  comment_count integer not null default 0 constraint posts_comment_count_nonneg check (comment_count >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists posts_feed_idx on public.posts (created_at desc, id desc);
create index if not exists posts_author_feed_idx on public.posts (author_id, created_at desc, id desc);
create index if not exists posts_category_feed_idx on public.posts (category, created_at desc, id desc);

comment on table public.posts is 'GenZ in Action: user posts. Visible per public.can_view_author_content(author_id).';

-- updated_at moves only on real content edits.
create or replace function public.posts_set_edited_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.type, new.category, new.title, new.body, new.location, new.event_at)
     is distinct from (old.type, old.category, old.title, old.body, old.location, old.event_at) then
    new.updated_at := now();
  else
    new.updated_at := old.updated_at;
  end if;
  return new;
end;
$$;
revoke execute on function public.posts_set_edited_at() from public, anon, authenticated;

create or replace trigger posts_set_edited_at
  before update on public.posts
  for each row execute function public.posts_set_edited_at();

-- Privileges: the app may create/edit only content columns; never counters,
-- timestamps or ids. author_id is checked by RLS.
revoke all on table public.posts from anon, authenticated;
grant select, delete on table public.posts to authenticated;
grant insert (author_id, type, category, title, body, location, event_at) on table public.posts to authenticated;
grant update (type, category, title, body, location, event_at) on table public.posts to authenticated;

alter table public.posts enable row level security;

drop policy if exists "posts_select_visible" on public.posts;
create policy "posts_select_visible"
  on public.posts for select to authenticated
  using (public.can_view_author_content(author_id));

drop policy if exists "posts_insert_own" on public.posts;
create policy "posts_insert_own"
  on public.posts for insert to authenticated
  with check ((select auth.uid()) = author_id);

drop policy if exists "posts_update_own" on public.posts;
create policy "posts_update_own"
  on public.posts for update to authenticated
  using ((select auth.uid()) = author_id)
  with check ((select auth.uid()) = author_id);

drop policy if exists "posts_delete_own" on public.posts;
create policy "posts_delete_own"
  on public.posts for delete to authenticated
  using ((select auth.uid()) = author_id);
