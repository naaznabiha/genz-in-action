-- =============================================================================
-- Migration 20261021100300_profile_avatar_path
-- Phase 2 · Step 4 of 8
-- =============================================================================
-- Changes : • adds public.profiles.avatar_path (nullable)
--           • public.validate_profile_avatar() + trigger: a new avatar_path
--             must be an existing object in the user's OWN avatars folder
--           • withdraws the API's UPDATE right on the unused avatar_url column
-- Depends : Phase 1 profiles; 20261021100200_avatars_storage.
-- Safe to re-run : yes.
-- Destructive    : no. No column is dropped; no data is changed.
--
-- Why a storage path instead of avatar_url (decision D20 — please confirm):
-- a free-text URL column would let a user point their avatar at any external
-- address, bypassing the bucket's JPEG/PNG + 5 MB limits and leaking viewers'
-- IP addresses to a third-party server. Storing the object path and checking it
-- exists in the caller's own folder closes that. The app builds the display URL
-- with supabase.storage.from('avatars').getPublicUrl(path).
-- avatar_url (Phase 1) stays in place but is read-only for the API and unused
-- by the app; drop it in a later, deliberate migration once confirmed.
-- =============================================================================

alter table public.profiles add column if not exists avatar_path text;

do $$
begin
  if not exists (select 1 from pg_constraint
                 where conname = 'profiles_avatar_path_format'
                   and conrelid = 'public.profiles'::regclass) then
    alter table public.profiles
      add constraint profiles_avatar_path_format check (
        avatar_path is null
        or avatar_path ~ ('^' || id::text || '/avatar-[0-9]{10,16}\.(jpg|png)$')
      );
  end if;
end;
$$;

comment on column public.profiles.avatar_path is
  'Object path in the public `avatars` bucket (<user id>/avatar-<n>.jpg|png). Must exist and belong to the user.';
comment on column public.profiles.avatar_url is
  'DEPRECATED (Phase 2): not written by the app or the API. Use avatar_path.';

create or replace function public.validate_profile_avatar()
returns trigger
language plpgsql
security definer          -- reads storage.objects, which the caller cannot list
set search_path = ''
as $$
begin
  if new.avatar_path is not null
     and new.avatar_path is distinct from old.avatar_path
     and not exists (
       select 1 from storage.objects o
        where o.bucket_id = 'avatars'
          and o.name = new.avatar_path
          and (storage.foldername(o.name))[1] = new.id::text
     ) then
    raise exception using
      errcode = '22023',
      message = 'GENZ_AVATAR_NOT_FOUND: upload the photo before saving it to your profile';
  end if;
  return new;
end;
$$;

revoke execute on function public.validate_profile_avatar() from public, anon, authenticated;

create or replace trigger profiles_validate_avatar
  before update of avatar_path on public.profiles
  for each row
  execute function public.validate_profile_avatar();

-- Column privileges: avatar_path becomes editable (own row only, via the
-- existing profiles_update_own policy); avatar_url is no longer writable.
grant update (avatar_path) on table public.profiles to authenticated;
revoke update (avatar_url) on table public.profiles from authenticated;
