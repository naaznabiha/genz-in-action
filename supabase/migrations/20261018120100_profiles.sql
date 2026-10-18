-- =============================================================================
-- Migration 20261018120100_profiles
-- Phase 1 · Step 2 of 4
-- =============================================================================
-- Creates : table public.profiles (1:1 with auth.users), its constraints,
--           indexes, column-level grants, RLS policies and updated_at trigger.
-- Depends : 20261018120000_shared_utilities (public.set_updated_at).
-- Safe to re-run : yes. Table/index use IF NOT EXISTS; policies and the trigger
--           are (re)created by name, so a re-run converges on the same state.
-- Destructive    : no data is deleted or modified. The only DROP statements
--           target the two policies this file itself defines, so they can be
--           recreated with the current definition.
-- Guard   : if a public.profiles table already exists with a DIFFERENT shape
--           (e.g. from a starter template), this file stops with an error
--           before changing anything.
-- Spec    : §10 profiles, §11 usernames, §12 RLS. FR-16 field limits follow
--           the prototype (bio 160 chars).
-- =============================================================================

-- 0. Guard against an incompatible pre-existing table ---------------------------
do $$
declare
  missing text;
begin
  if to_regclass('public.profiles') is not null then
    select string_agg(col, ', ')
      into missing
      from unnest(array['id', 'username', 'display_name', 'bio', 'avatar_url',
                        'location', 'is_private', 'created_at', 'updated_at']) as col
     where not exists (
       select 1 from information_schema.columns c
        where c.table_schema = 'public' and c.table_name = 'profiles' and c.column_name = col
     );
    if missing is not null then
      raise exception
        'public.profiles already exists but is missing column(s): %. Nothing was changed. '
        'Review the existing table (see supabase/checks/00_preflight_inspect.sql) before continuing.', missing;
    end if;
  end if;
end;
$$;

-- 1. Table ---------------------------------------------------------------------
create table if not exists public.profiles (
  -- 1:1 with auth.users. ON DELETE CASCADE is intentional: a profile row has no
  -- meaning without its auth user. Authored content (posts, communities…) added
  -- in later phases must NOT rely on this cascade — account deletion will be a
  -- privileged Edge Function workflow (spec §11 "Deletion baseline").
  id           uuid primary key references auth.users (id) on delete cascade,
  -- Stored lowercase; 3–30 chars of a–z, 0–9, underscore.
  username     text not null
               constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,30}$'),
  display_name text not null
               constraint profiles_display_name_length check (char_length(btrim(display_name)) between 1 and 50),
  bio          text
               constraint profiles_bio_length check (bio is null or char_length(bio) <= 160),
  avatar_url   text
               constraint profiles_avatar_url_length check (avatar_url is null or char_length(avatar_url) <= 2048),
  -- Coarse, user-entered location only (spec §11 Location).
  location     text
               constraint profiles_location_length check (location is null or char_length(location) <= 80),
  -- Private profiles require follow approval (spec FR-10/FR-11, implemented in M6).
  is_private   boolean not null default false,
  created_at   timestamptz not null default now(),   -- "Joined" date (FR-16)
  updated_at   timestamptz not null default now()
);

comment on table public.profiles is
  'GenZ in Action: public profile metadata, one row per auth.users row. Created by trigger on signup.';

-- 2. Case-insensitive unique usernames (spec §6.1, §11) ------------------------
create unique index if not exists profiles_username_lower_key
  on public.profiles (lower(username));

-- 3. Privileges (least privilege) ---------------------------------------------
-- Supabase grants ALL on new public tables to anon and authenticated by default.
-- Replace that with exactly what the app needs:
--   • anon (signed-out)  : nothing. Username availability uses an RPC instead.
--   • authenticated      : read profiles; update only editable columns.
--   • INSERT / DELETE    : nobody via the API. Rows are created by the signup
--                          trigger and removed with the auth user.
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (username, display_name, bio, avatar_url, location, is_private)
  on table public.profiles to authenticated;

-- 4. Row Level Security --------------------------------------------------------
alter table public.profiles enable row level security;

-- Phase 1: any signed-in user can read basic profile identity.
-- M6 (social graph) will replace this with a block/privacy-aware predicate.
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles
  for select
  to authenticated
  using (true);

-- Users can update only their own row (spec §12).
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- 5. updated_at maintenance ----------------------------------------------------
create or replace trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();
