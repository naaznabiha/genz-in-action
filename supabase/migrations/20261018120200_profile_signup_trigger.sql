-- =============================================================================
-- Migration 20261018120200_profile_signup_trigger
-- Phase 1 · Step 3 of 4
-- =============================================================================
-- Creates : • public.handle_new_user()       — trigger function
--           • trigger on_auth_user_created     — AFTER INSERT ON auth.users
--           • public.is_username_available()   — RPC used by the signup form
-- Depends : 20261018120100_profiles.
-- Safe to re-run : yes (CREATE OR REPLACE for functions and trigger).
-- Destructive    : no.
--
-- Behaviour
--   The app sends `username` and `display_name` in signUp() user metadata.
--   On every new auth user this trigger inserts the matching profile row:
--     • username provided & valid & free → used as-is (lowercased).
--     • username provided but invalid or already taken → the signup is
--       rejected (Supabase Auth returns "Database error saving new user";
--       the app shows a readable message). This only happens on a race,
--       because the app checks availability first.
--     • no username (e.g. future Google/Apple sign-in, or a user created in
--       the dashboard) → a placeholder `user_<12 hex>` is generated; the user
--       can change it later in Edit Profile.
--   Display name falls back to provider name, then the email local-part.
--
-- Note on email confirmation: the profile row is created at signup time, i.e.
-- BEFORE the email is confirmed. The username is therefore reserved by an
-- unconfirmed account. Supabase does not issue a session until confirmation,
-- so the app never treats the account as active before that (spec §11).
-- =============================================================================

-- 1. Signup trigger function ---------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer          -- needs to write public.profiles regardless of RLS
set search_path = ''      -- prevent search_path hijacking in a definer function
as $$
declare
  meta               jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  requested_username text  := lower(btrim(coalesce(meta ->> 'username', '')));
  requested_name     text  := btrim(coalesce(meta ->> 'display_name', meta ->> 'full_name', meta ->> 'name', ''));
  final_username     text;
begin
  if requested_username <> '' then
    if requested_username !~ '^[a-z0-9_]{3,30}$' then
      raise exception using
        errcode = '22023',
        message = 'GENZ_USERNAME_INVALID: usernames are 3-30 characters of a-z, 0-9 and _';
    end if;
    if exists (select 1 from public.profiles p where lower(p.username) = requested_username) then
      raise exception using
        errcode = '23505',
        message = 'GENZ_USERNAME_TAKEN: that username is already in use';
    end if;
    final_username := requested_username;
  else
    final_username := 'user_' || substr(replace(new.id::text, '-', ''), 1, 12);
  end if;

  if requested_name = '' then
    requested_name := coalesce(nullif(split_part(coalesce(new.email, ''), '@', 1), ''), final_username);
  end if;
  requested_name := left(requested_name, 50);

  insert into public.profiles (id, username, display_name)
  values (new.id, final_username, requested_name)
  on conflict (id) do nothing;

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'GenZ in Action: creates public.profiles row for each new auth.users row.';

-- Only the trigger should run this; never expose it via the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- 2. Trigger on auth.users -----------------------------------------------------
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- 3. Username availability RPC -------------------------------------------------
-- Called by the signup form before signUp() and by Edit Profile later.
-- Exact, case-insensitive match (no LIKE wildcards). Returns false for an
-- invalid format too. Usernames are public, so exposing availability is fine.
create or replace function public.is_username_available(candidate text)
returns boolean
language sql
stable
security definer          -- anon has no SELECT on profiles; this reads via the owner
set search_path = ''
as $$
  select lower(btrim(coalesce(candidate, ''))) ~ '^[a-z0-9_]{3,30}$'
     and not exists (
       select 1
         from public.profiles p
        where lower(p.username) = lower(btrim(candidate))
     );
$$;

comment on function public.is_username_available(text) is
  'GenZ in Action: true when the username is well-formed and not taken (case-insensitive).';

revoke execute on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to anon, authenticated;
