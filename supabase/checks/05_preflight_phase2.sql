-- =============================================================================
-- 05_preflight_phase2.sql — READ-ONLY. Run BEFORE the Phase 2 migrations.
-- =============================================================================
-- Shows whether anything the Phase 2 migrations create already exists, so
-- nothing is overwritten blindly. Changes: NONE.
--   OK      → nothing conflicting.
--   EXISTS  → an object with this name already exists. If you did not create
--             it by running a Phase 2 file earlier, STOP and compare it with
--             the migration first.
--   MISSING → a Phase 1 prerequisite is absent. Run Phase 1 first.
-- =============================================================================

with names(ord, kind, obj) as (
  values
    (1, 'table', 'public.profile_tags'),
    (2, 'table', 'public.user_profile_tags'),
    (3, 'table', 'public.user_settings'),
    (4, 'table', 'public.activity_event_types'),
    (5, 'table', 'public.activity_events'),
    (6, 'table', 'public.badges'),
    (7, 'table', 'public.user_badges'),
    (8, 'table', 'public.impact_scoring_versions'),
    (9, 'table', 'public.impact_event_weights')
),
checks as (
  select 0 as ord, 'Phase 1: public.profiles' as check_name,
         case when to_regclass('public.profiles') is null then 'MISSING' else 'OK' end as status,
         '' as detail
  union all
  select n.ord, n.kind || ' ' || n.obj,
         case when to_regclass(n.obj) is null then 'OK' else 'EXISTS' end,
         case when to_regclass(n.obj) is null then 'not present' else 'present' end
    from names n
  union all
  select 20, 'column profiles.avatar_path',
         case when exists (select 1 from information_schema.columns
                           where table_schema = 'public' and table_name = 'profiles' and column_name = 'avatar_path')
              then 'EXISTS' else 'OK' end, ''
  union all
  select 21, 'storage bucket avatars',
         case when exists (select 1 from storage.buckets where id = 'avatars') then 'EXISTS' else 'OK' end,
         coalesce((select 'public=' || public || ', limit=' || coalesce(file_size_limit::text, 'none')
                          || ', mime=' || coalesce(array_to_string(allowed_mime_types, ','), 'any')
                     from storage.buckets where id = 'avatars'), 'not present')
  union all
  select 22, 'storage policies mentioning avatars',
         case when exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                           and (policyname ilike '%avatar%' or coalesce(qual, '') ilike '%avatars%'
                                or coalesce(with_check, '') ilike '%avatars%'))
              then 'EXISTS' else 'OK' end,
         coalesce((select string_agg(policyname || ' (' || cmd || ')', ', ') from pg_policies
                    where schemaname = 'storage' and tablename = 'objects'), 'none')
  union all
  select 23, 'function public.update_my_profile',
         case when exists (select 1 from pg_proc p join pg_namespace s on s.oid = p.pronamespace
                           where s.nspname = 'public' and p.proname = 'update_my_profile')
              then 'EXISTS' else 'OK' end, ''
  union all
  select 24, 'function public.get_my_impact_summary',
         case when exists (select 1 from pg_proc p join pg_namespace s on s.oid = p.pronamespace
                           where s.nspname = 'public' and p.proname = 'get_my_impact_summary')
              then 'EXISTS' else 'OK' end, ''
)
select check_name, status, detail from checks order by ord;
