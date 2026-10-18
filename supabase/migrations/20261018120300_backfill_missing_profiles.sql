-- =============================================================================
-- Migration 20261018120300_backfill_missing_profiles
-- Phase 1 · Step 4 of 4
-- =============================================================================
-- Purpose : Give every auth user that existed BEFORE the signup trigger was
--           installed (e.g. test accounts created during setup) a profile row,
--           so the app never finds a signed-in user without a profile.
-- Depends : 20261018120100_profiles.
-- Safe to re-run : yes. Only inserts rows for users that have no profile yet;
--           existing profiles are never modified.
-- Destructive    : no.
-- Effect  : backfilled users get username `user_<12 hex>` (always unique,
--           because it is derived from their unique id) and a display name from
--           metadata or their email local-part. They can rename later.
-- If preflight reported 0 auth users, this inserts nothing; running it is
-- still harmless.
-- =============================================================================

insert into public.profiles (id, username, display_name)
select
  u.id,
  'user_' || substr(replace(u.id::text, '-', ''), 1, 12),
  left(
    coalesce(
      nullif(btrim(coalesce(u.raw_user_meta_data ->> 'display_name',
                            u.raw_user_meta_data ->> 'full_name',
                            u.raw_user_meta_data ->> 'name', '')), ''),
      nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
      'user_' || substr(replace(u.id::text, '-', ''), 1, 12)
    ),
    50
  )
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict do nothing;
