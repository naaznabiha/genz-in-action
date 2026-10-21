-- =============================================================================
-- 45_preflight_phase3.sql — READ-ONLY. Run BEFORE the Phase 3 migrations.
-- =============================================================================
-- OK = nothing conflicting. EXISTS = an object with that name already exists
-- (stop and compare unless you ran a Phase 3 file before). MISSING = a Phase
-- 1/2 prerequisite is absent (run those first). Changes: NONE.
-- =============================================================================

with t(ord, name) as (
  values (1, 'follows'), (2, 'follow_requests'), (3, 'blocks'), (4, 'posts'), (5, 'post_media'), (6, 'hashtags'),
         (7, 'post_hashtags'), (8, 'post_likes'), (9, 'post_saves'), (10, 'comments'), (11, 'notifications')
),
checks as (
  select 0 as ord, 'Phase 1/2 prerequisites (profiles, profile_tags, user_settings, activity ledger)' as check_name,
         case when to_regclass('public.profiles') is null or to_regclass('public.profile_tags') is null
                or to_regclass('public.user_settings') is null or to_regclass('public.activity_events') is null
              then 'MISSING' else 'OK' end as status,
         '' as detail
  union all
  select t.ord, 'table public.' || t.name,
         case when to_regclass('public.' || t.name) is null then 'OK' else 'EXISTS' end,
         case when to_regclass('public.' || t.name) is null then 'not present' else 'present' end
    from t
  union all
  select 20, 'storage bucket post-media',
         case when exists (select 1 from storage.buckets where id = 'post-media') then 'EXISTS' else 'OK' end, ''
  union all
  select 21, 'functions with Phase 3 names',
         case when exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                           where n.nspname = 'public' and p.proname in ('create_post', 'get_posts', 'follow_user', 'block_user', 'can_view_author_content'))
              then 'EXISTS' else 'OK' end,
         coalesce((select string_agg(p.proname, ', ') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                    where n.nspname = 'public' and p.proname in ('create_post', 'get_posts', 'follow_user', 'block_user', 'can_view_author_content')), '')
  union all
  select 30, 'accounts / profiles', 'INFO',
         (select count(*) from auth.users)::text || ' users, ' || (select count(*) from public.profiles)::text || ' profiles'
)
select check_name, status, detail from checks order by ord;
