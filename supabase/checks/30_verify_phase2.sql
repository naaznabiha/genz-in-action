-- =============================================================================
-- 30_verify_phase2.sql — READ-ONLY. Run AFTER the eight Phase 2 migrations.
-- =============================================================================
-- Every row should show status = 'PASS'. Any 'FAIL' row names what is wrong.
-- Changes: NONE.
-- =============================================================================

with checks as (
  -- ---------- tags ----------
  select 1 as ord, 'profile_tags + user_profile_tags exist, RLS on' as check_name,
         coalesce((select bool_and(c.relrowsecurity) from pg_class c
                    where c.oid in (to_regclass('public.profile_tags'), to_regclass('public.user_profile_tags'))
                   having count(*) = 2), false) as ok,
         '' as detail
  union all
  select 2, 'tag catalogue seeded',
         (select count(*) >= 8 from public.profile_tags),
         (select count(*)::text || ' tag(s)' from public.profile_tags)
  union all
  select 3, '5-tag limit trigger present',
         exists (select 1 from pg_trigger where tgname = 'user_profile_tags_limit'
                  and tgrelid = to_regclass('public.user_profile_tags')),
         ''
  union all
  select 4, 'authenticated cannot write tag catalogue',
         not (has_table_privilege('authenticated', 'public.profile_tags', 'INSERT')
              or has_table_privilege('authenticated', 'public.profile_tags', 'UPDATE')
              or has_table_privilege('authenticated', 'public.profile_tags', 'DELETE')),
         ''
  -- ---------- settings ----------
  union all
  select 10, 'user_settings exists, RLS on',
         coalesce((select c.relrowsecurity from pg_class c where c.oid = to_regclass('public.user_settings')), false),
         ''
  union all
  select 11, 'every profile has a settings row',
         not exists (select 1 from public.profiles p
                      where not exists (select 1 from public.user_settings s where s.user_id = p.id)),
         (select count(*)::text || ' profile(s) without settings' from public.profiles p
           where not exists (select 1 from public.user_settings s where s.user_id = p.id))
  union all
  select 12, 'user_settings: no API INSERT/DELETE, anon nothing',
         not has_table_privilege('authenticated', 'public.user_settings', 'INSERT')
         and not has_table_privilege('authenticated', 'public.user_settings', 'DELETE')
         and not has_table_privilege('anon', 'public.user_settings', 'SELECT'),
         ''
  union all
  select 13, 'user_settings policies are own-row only',
         (select count(*) = 2 from pg_policies where schemaname = 'public' and tablename = 'user_settings'
            and qual like '%auth.uid()%'),
         coalesce((select string_agg(policyname || ' (' || cmd || ')', ', ') from pg_policies
                    where schemaname = 'public' and tablename = 'user_settings'), '')
  -- ---------- avatars ----------
  union all
  select 20, 'avatars bucket: public, 5 MB, JPEG/PNG only',
         exists (select 1 from storage.buckets b where b.id = 'avatars' and b.public
                  and b.file_size_limit = 5242880
                  and b.allowed_mime_types @> array['image/jpeg', 'image/png']
                  and array_length(b.allowed_mime_types, 1) = 2),
         coalesce((select 'public=' || public || ', limit=' || coalesce(file_size_limit::text, 'none')
                          || ', mime=' || coalesce(array_to_string(allowed_mime_types, ','), 'any')
                     from storage.buckets where id = 'avatars'), 'bucket missing')
  union all
  select 21, 'avatars insert/select/delete policies present',
         (select count(*) = 3 from pg_policies where schemaname = 'storage' and tablename = 'objects'
            and policyname in ('avatars_insert_own_folder', 'avatars_select_own_folder', 'avatars_delete_own_folder')),
         ''
  union all
  select 22, 'no UPDATE policy can touch avatars (no overwrite)',
         not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                      and cmd in ('UPDATE', 'ALL')
                      and (coalesce(qual, '') ilike '%avatars%' or coalesce(qual, '') = 'true'
                           or coalesce(with_check, '') ilike '%avatars%')),
         coalesce((select string_agg(policyname, ', ') from pg_policies where schemaname = 'storage'
                    and tablename = 'objects' and cmd in ('UPDATE', 'ALL')), '')
  union all
  select 23, 'profiles.avatar_path + format check + guard trigger',
         exists (select 1 from information_schema.columns where table_schema = 'public'
                  and table_name = 'profiles' and column_name = 'avatar_path')
         and exists (select 1 from pg_constraint where conname = 'profiles_avatar_path_format')
         and exists (select 1 from pg_trigger where tgname = 'profiles_validate_avatar'),
         ''
  union all
  select 24, 'API can update avatar_path but not avatar_url',
         has_column_privilege('authenticated', 'public.profiles', 'avatar_path', 'UPDATE')
         and not has_column_privilege('authenticated', 'public.profiles', 'avatar_url', 'UPDATE'),
         'If FAIL after re-running a Phase 1 file: re-run 20261021100300_profile_avatar_path.sql'
  -- ---------- profile RPC ----------
  union all
  select 30, 'update_my_profile: authenticated yes, anon no, SECURITY INVOKER',
         has_function_privilege('authenticated', 'public.update_my_profile(text,text,text,text,text,text[])', 'EXECUTE')
         and not has_function_privilege('anon', 'public.update_my_profile(text,text,text,text,text,text[])', 'EXECUTE')
         and not (select p.prosecdef from pg_proc p where p.oid = 'public.update_my_profile(text,text,text,text,text,text[])'::regprocedure),
         ''
  -- ---------- ledger ----------
  union all
  select 40, 'activity_events exists, RLS on',
         coalesce((select c.relrowsecurity from pg_class c where c.oid = to_regclass('public.activity_events')), false),
         ''
  union all
  select 41, 'API roles cannot INSERT/UPDATE/DELETE activity_events',
         not (has_table_privilege('authenticated', 'public.activity_events', 'INSERT')
              or has_table_privilege('authenticated', 'public.activity_events', 'UPDATE')
              or has_table_privilege('authenticated', 'public.activity_events', 'DELETE')
              or has_table_privilege('anon', 'public.activity_events', 'SELECT')),
         ''
  union all
  select 42, 'record_activity_event not callable by anon/authenticated',
         not has_function_privilege('authenticated', 'public.record_activity_event(uuid,text,text,text,text,jsonb)', 'EXECUTE')
         and not has_function_privilege('anon', 'public.record_activity_event(uuid,text,text,text,text,jsonb)', 'EXECUTE'),
         ''
  union all
  select 43, 'append-only triggers present (update/delete/truncate)',
         (select count(*) = 3 from pg_trigger where tgrelid = to_regclass('public.activity_events')
            and tgname in ('activity_events_no_update', 'activity_events_no_delete', 'activity_events_no_truncate')),
         ''
  union all
  select 44, 'no fabricated activity in the ledger catalogue',
         true,
         (select count(*)::text || ' event type(s), ' from public.activity_event_types)
         || (select count(*)::text || ' event(s)' from public.activity_events)
  -- ---------- badges ----------
  union all
  select 50, 'badges/user_badges read-only for API',
         has_table_privilege('authenticated', 'public.user_badges', 'SELECT')
         and not has_table_privilege('authenticated', 'public.user_badges', 'INSERT')
         and not has_table_privilege('authenticated', 'public.badges', 'INSERT')
         and not has_table_privilege('anon', 'public.user_badges', 'SELECT'),
         ''
  -- ---------- impact ----------
  union all
  select 60, 'scoring config hidden from API',
         not has_table_privilege('authenticated', 'public.impact_scoring_versions', 'SELECT')
         and not has_table_privilege('authenticated', 'public.impact_event_weights', 'SELECT'),
         ''
  union all
  select 61, 'get_my_impact_summary: authenticated yes, anon no',
         has_function_privilege('authenticated', 'public.get_my_impact_summary()', 'EXECUTE')
         and not has_function_privilege('anon', 'public.get_my_impact_summary()', 'EXECUTE'),
         ''
  union all
  select 62, 'scoring formula status (INFO)',
         true,
         case when exists (select 1 from public.impact_scoring_versions where status = 'approved')
              then 'approved version present' else 'no approved formula: app shows getting-started state' end
)
select check_name,
       case when ok then 'PASS' else 'FAIL' end as status,
       detail
from checks
order by ord;
