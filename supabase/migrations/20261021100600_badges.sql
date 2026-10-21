-- =============================================================================
-- Migration 20261021100600_badges
-- Phase 2 · Step 7 of 8
-- =============================================================================
-- Creates : • public.badges       — badge definitions (EMPTY)
--           • public.user_badges  — badges awarded to users (EMPTY)
-- Depends : Phase 1 (public.profiles).
-- Safe to re-run : yes.
-- Destructive    : no.
-- Spec    : FR-17 "earned badges", §10 badges / user_badges.
--
-- No badge definitions or awards are seeded: which badges exist and how they
-- are earned is not specified yet. Awards will be written only by trusted
-- database logic (a SECURITY DEFINER function or trigger added with the badge
-- rules), never by the app. The About tab shows an empty state until then.
-- =============================================================================

create table if not exists public.badges (
  id          text primary key
              constraint badges_id_format check (id ~ '^[a-z][a-z0-9_-]{2,40}$'),
  name        text not null
              constraint badges_name_length check (char_length(btrim(name)) between 1 and 40),
  description text
              constraint badges_description_length check (description is null or char_length(description) <= 200),
  emoji       text
              constraint badges_emoji_length check (emoji is null or char_length(emoji) <= 16),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.user_badges (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  badge_id   text not null references public.badges (id) on delete restrict,
  awarded_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

create index if not exists user_badges_badge_id_idx on public.user_badges (badge_id);

comment on table public.badges is 'GenZ in Action: badge definitions. Managed by migrations only.';
comment on table public.user_badges is 'GenZ in Action: badges earned by users. Written only by trusted database logic.';

-- Read-only for signed-in users (badges are shown on profiles). No API writes.
revoke all on table public.badges from anon, authenticated;
grant select on table public.badges to authenticated;
revoke all on table public.user_badges from anon, authenticated;
grant select on table public.user_badges to authenticated;

alter table public.badges enable row level security;
alter table public.user_badges enable row level security;

drop policy if exists "badges_select_authenticated" on public.badges;
create policy "badges_select_authenticated"
  on public.badges for select to authenticated
  using (true);

-- M6 will make this block/privacy-aware together with profiles.
drop policy if exists "user_badges_select_authenticated" on public.user_badges;
create policy "user_badges_select_authenticated"
  on public.user_badges for select to authenticated
  using (true);
