-- =============================================================================
-- 75_preflight_phase4.sql — READ-ONLY. Run BEFORE the five Phase 4 migrations.
-- =============================================================================
-- OK = ready. MISSING = a Phase 3 prerequisite is absent (apply Phase 3 first).
-- EXISTS = a Phase 4 object already exists — fine if you ran a Phase 4 file
-- before (every Phase 4 file is safe to re-run). INFO = for your records.
-- Changes: NONE.
-- =============================================================================

with prereq(ord, label, present) as (
  values
    (1, 'Phase 3 tables (posts, hashtags, post_hashtags, follows, blocks, follow_requests)',
        to_regclass('public.posts') is not null and to_regclass('public.hashtags') is not null
        and to_regclass('public.post_hashtags') is not null and to_regclass('public.follows') is not null
        and to_regclass('public.blocks') is not null and to_regclass('public.follow_requests') is not null),
    (2, 'Phase 3 shared visibility helpers (can_see_profile, can_view_author_content, is_blocked_between)',
        to_regprocedure('public.can_see_profile(uuid)') is not null
        and to_regprocedure('public.can_view_author_content(uuid)') is not null
        and to_regprocedure('public.is_blocked_between(uuid,uuid)') is not null),
    (3, 'Phase 3 RPCs Phase 4 builds on (get_posts, get_suggested_people, relationship_with)',
        to_regprocedure('public.get_posts(uuid,uuid,text,timestamptz,uuid,integer,text)') is not null
        and to_regprocedure('public.get_suggested_people(integer)') is not null
        and to_regprocedure('public.relationship_with(uuid)') is not null),
    (4, 'Phase 2 profile tags (used by People suggestions)',
        to_regclass('public.user_profile_tags') is not null),
    (5, 'post full-text index posts_search_idx (Phase 3 audit fix)',
        to_regclass('public.posts_search_idx') is not null)
),
checks as (
  select ord, label as check_name, case when present then 'OK' else 'MISSING' end as status, '' as detail
    from prereq
  union all
  select 10, 'functions with Phase 4 names',
         case when exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                            where n.nspname = 'public'
                              and p.proname in ('query_posts', 'search_tsquery', 'search_profiles', 'search_hashtags',
                                                'get_hashtag', 'follower_count', 'get_trending_hashtags', 'get_people_suggestions'))
              then 'EXISTS' else 'OK' end,
         coalesce((select string_agg(distinct p.proname, ', ') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                    where n.nspname = 'public'
                      and p.proname in ('query_posts', 'search_tsquery', 'search_profiles', 'search_hashtags',
                                        'get_hashtag', 'follower_count', 'get_trending_hashtags', 'get_people_suggestions')), '')
  union all
  select 11, 'indexes with Phase 4 names',
         case when to_regclass('public.profiles_search_idx') is not null or to_regclass('public.profiles_username_prefix_idx') is not null
                or to_regclass('public.hashtags_tag_prefix_idx') is not null then 'EXISTS' else 'OK' end,
         ''
  union all
  select 20, 'Postgres version (needs 12+ for plan_cache_mode)',
         case when current_setting('server_version_num')::int >= 120000 then 'OK' else 'MISSING' end,
         current_setting('server_version')
  union all
  select 30, 'data', 'INFO',
         (select count(*) from public.profiles)::text || ' profiles, '
         || (select count(*) from public.posts)::text || ' posts, '
         || (select count(*) from public.hashtags)::text || ' hashtags, '
         || (select count(*) from public.posts where created_at > now() - interval '7 days')::text || ' posts in the last 7 days'
)
select check_name, status, detail from checks order by ord;
