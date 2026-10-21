-- =============================================================================
-- Migration 20261021100100_user_settings
-- Phase 2 · Step 2 of 8
-- =============================================================================
-- Creates : • public.user_settings (1:1 with profiles)
--           • public.handle_new_profile_settings() + trigger on profiles
--           • backfill of a settings row for every existing profile
-- Depends : Phase 1 (public.profiles, public.set_updated_at).
-- Safe to re-run : yes.
-- Destructive    : no. Backfill only inserts missing rows.
-- Spec    : §10 user_settings, §12 "Users can update their own profile/settings
--           only", FR-19 notification preferences.
--
-- What is (and is NOT) stored here — decision D18, PROPOSED, please confirm:
--   • notify_activity : in-app notifications for likes, comments and new
--     followers (spec §11 MVP in-app notification types). Default ON. It is
--     honoured by the notification triggers added with those features (M5/M8).
--   • NOT stored: push / email preferences (push is deferred from MVP, email is
--     not specified; spec §18) and "data sharing" (no analytics exists yet).
--     Add columns in a new migration if those are approved.
--   • The Private Account switch is profiles.is_private (Phase 1 column, spec
--     §10 puts privacy on profiles), not duplicated here.
-- =============================================================================

create table if not exists public.user_settings (
  user_id         uuid primary key references public.profiles (id) on delete cascade,
  notify_activity boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.user_settings is
  'GenZ in Action: per-user preferences that do not belong on profiles. One row per profile (trigger-created).';
comment on column public.user_settings.notify_activity is
  'In-app notifications for likes, comments and new followers. Honoured by notification triggers (M5/M8).';

create or replace trigger user_settings_set_updated_at
  before update on public.user_settings
  for each row
  execute function public.set_updated_at();

-- Every new profile gets a settings row with defaults.
create or replace function public.handle_new_profile_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_settings (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_profile_settings() from public, anon, authenticated;

create or replace trigger on_profile_created_settings
  after insert on public.profiles
  for each row
  execute function public.handle_new_profile_settings();

-- Backfill existing profiles.
insert into public.user_settings (user_id)
select p.id from public.profiles p
where not exists (select 1 from public.user_settings s where s.user_id = p.id)
on conflict (user_id) do nothing;

-- Privileges: read and update your own row only; rows are created/removed by
-- the database, never through the API.
revoke all on table public.user_settings from anon, authenticated;
grant select on table public.user_settings to authenticated;
grant update (notify_activity) on table public.user_settings to authenticated;

alter table public.user_settings enable row level security;

drop policy if exists "user_settings_select_own" on public.user_settings;
create policy "user_settings_select_own"
  on public.user_settings for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "user_settings_update_own" on public.user_settings;
create policy "user_settings_update_own"
  on public.user_settings for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
