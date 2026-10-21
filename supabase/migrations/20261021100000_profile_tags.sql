-- =============================================================================
-- Migration 20261021100000_profile_tags
-- Phase 2 · Step 1 of 8
-- =============================================================================
-- Creates : • public.profile_tags       — catalogue of selectable profile tags
--           • public.user_profile_tags  — a user's chosen tags (max 5)
--           • public.enforce_profile_tag_limit() + trigger
-- Depends : Phase 1 (public.profiles).
-- Safe to re-run : yes (IF NOT EXISTS, CREATE OR REPLACE, policies recreated
--           by name, seed rows use ON CONFLICT DO NOTHING).
-- Destructive    : no.
-- Spec    : FR-16 ("up to five tags"), §10 profile_tags / user_profile_tags,
--           §11 "Profile tags are limited to five selected tags".
--
-- Seed catalogue (PROPOSED, decision D17 — please confirm): the eight cause
-- categories already used throughout the prototype (Home filters, category
-- chips, constants/theme.ts CategoryColors). Ids match CategoryId in the app so
-- the existing chip colours apply. Adding or renaming tags later is a data
-- change in a new migration; existing selections stay valid.
-- =============================================================================

-- 1. Catalogue -----------------------------------------------------------------
create table if not exists public.profile_tags (
  id         text primary key
             constraint profile_tags_id_format check (id ~ '^[a-z0-9][a-z0-9-]{1,30}$'),
  label      text not null
             constraint profile_tags_label_length check (char_length(btrim(label)) between 1 and 30),
  sort_order integer not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.profile_tags is
  'GenZ in Action: catalogue of profile tags users can pick (max 5 each). Managed by migrations only.';

insert into public.profile_tags (id, label, sort_order) values
  ('climate',       'Climate',       10),
  ('equality',      'Equality',      20),
  ('mental-health', 'Mental Health', 30),
  ('education',     'Education',     40),
  ('housing',       'Housing',       50),
  ('community',     'Community',     60),
  ('arts',          'Arts',          70),
  ('tech',          'Tech',          80)
on conflict (id) do nothing;

-- 2. A user's selected tags ----------------------------------------------------
create table if not exists public.user_profile_tags (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  tag_id     text not null references public.profile_tags (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (user_id, tag_id)
);

create index if not exists user_profile_tags_tag_id_idx on public.user_profile_tags (tag_id);

comment on table public.user_profile_tags is
  'GenZ in Action: tags a user shows on their profile. At most 5 per user (trigger-enforced).';

-- 3. Max-five rule, enforced in the database (not only in the app) -------------
create or replace function public.enforce_profile_tag_limit()
returns trigger
language plpgsql
security definer          -- must count all of the user's rows regardless of RLS
set search_path = ''
as $$
declare
  existing integer;
begin
  -- Serialise concurrent inserts for the same user so two requests cannot both
  -- see 4 rows and each add one more.
  perform pg_advisory_xact_lock(hashtext('genz.user_profile_tags'), hashtext(new.user_id::text));

  if not exists (select 1 from public.profile_tags t where t.id = new.tag_id and t.is_active) then
    raise exception using
      errcode = '22023',
      message = 'GENZ_UNKNOWN_TAG: that tag is not available';
  end if;

  select count(*) into existing
    from public.user_profile_tags u
   where u.user_id = new.user_id and u.tag_id <> new.tag_id;

  if existing >= 5 then
    raise exception using
      errcode = '22023',
      message = 'GENZ_TOO_MANY_TAGS: choose up to 5 tags';
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_profile_tag_limit() from public, anon, authenticated;

create or replace trigger user_profile_tags_limit
  before insert on public.user_profile_tags
  for each row
  execute function public.enforce_profile_tag_limit();

-- 4. Privileges + RLS ----------------------------------------------------------
-- Tags are public profile information: any signed-in user may read them.
-- Users add/remove only their own tags. Nobody edits the catalogue via the API.
revoke all on table public.profile_tags from anon, authenticated;
grant select on table public.profile_tags to authenticated;

revoke all on table public.user_profile_tags from anon, authenticated;
grant select, insert, delete on table public.user_profile_tags to authenticated;

alter table public.profile_tags enable row level security;
alter table public.user_profile_tags enable row level security;

drop policy if exists "profile_tags_select_authenticated" on public.profile_tags;
create policy "profile_tags_select_authenticated"
  on public.profile_tags for select to authenticated
  using (true);

-- M6 (social graph) will make profile reads block/privacy-aware; tags follow the
-- same rule as profiles at that point.
drop policy if exists "user_profile_tags_select_authenticated" on public.user_profile_tags;
create policy "user_profile_tags_select_authenticated"
  on public.user_profile_tags for select to authenticated
  using (true);

drop policy if exists "user_profile_tags_insert_own" on public.user_profile_tags;
create policy "user_profile_tags_insert_own"
  on public.user_profile_tags for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "user_profile_tags_delete_own" on public.user_profile_tags;
create policy "user_profile_tags_delete_own"
  on public.user_profile_tags for delete to authenticated
  using ((select auth.uid()) = user_id);
