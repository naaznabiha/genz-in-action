-- =============================================================================
-- Migration 20261021100400_update_my_profile_rpc
-- Phase 2 · Step 5 of 8
-- =============================================================================
-- Creates : public.update_my_profile(...) — saves Edit Profile in ONE
--           transaction: identity fields, avatar path and tags. Either all of
--           it is saved or none of it is.
-- Depends : 20261021100000_profile_tags, 20261021100300_profile_avatar_path.
-- Safe to re-run : yes (CREATE OR REPLACE).
-- Destructive    : no.
--
-- SECURITY INVOKER on purpose: it runs as the signed-in user, so every Phase 1
-- rule still applies (RLS own-row update, column privileges, CHECK
-- constraints, the case-insensitive unique username index, the avatar guard
-- and the 5-tag trigger). It adds no privilege the user does not already have.
--
-- Errors the app maps to readable messages:
--   23505 profiles_username_lower_key → username already taken (server-side)
--   23514 profiles_*                  → a field failed its length/format check
--   22023 GENZ_TOO_MANY_TAGS / GENZ_UNKNOWN_TAG / GENZ_AVATAR_NOT_FOUND
--   42501                             → not signed in
-- =============================================================================

create or replace function public.update_my_profile(
  p_display_name text,
  p_username     text,
  p_bio          text,
  p_location     text,
  p_avatar_path  text,
  p_tag_ids      text[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid  uuid := auth.uid();
  tags text[];
begin
  if uid is null then
    raise exception using errcode = '42501', message = 'GENZ_NOT_SIGNED_IN: sign in to edit your profile';
  end if;

  select coalesce(array_agg(distinct t), '{}')
    into tags
    from unnest(coalesce(p_tag_ids, '{}')) as t
   where t is not null;

  if cardinality(tags) > 5 then
    raise exception using errcode = '22023', message = 'GENZ_TOO_MANY_TAGS: choose up to 5 tags';
  end if;

  update public.profiles
     set display_name = btrim(coalesce(p_display_name, '')),
         username     = lower(btrim(coalesce(p_username, ''))),
         bio          = nullif(btrim(coalesce(p_bio, '')), ''),
         location     = nullif(btrim(coalesce(p_location, '')), ''),
         avatar_path  = nullif(btrim(coalesce(p_avatar_path, '')), '')
   where id = uid;

  if not found then
    raise exception using errcode = 'P0002', message = 'GENZ_PROFILE_NOT_FOUND: no profile for this account';
  end if;

  delete from public.user_profile_tags
   where user_id = uid
     and not (tag_id = any (tags));

  insert into public.user_profile_tags (user_id, tag_id)
  select uid, t from unnest(tags) as t
  on conflict (user_id, tag_id) do nothing;
end;
$$;

comment on function public.update_my_profile(text, text, text, text, text, text[]) is
  'GenZ in Action: atomically saves the caller''s profile fields, avatar path and tags (max 5).';

revoke execute on function public.update_my_profile(text, text, text, text, text, text[]) from public, anon;
grant execute on function public.update_my_profile(text, text, text, text, text, text[]) to authenticated;
