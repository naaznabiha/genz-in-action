-- =============================================================================
-- 80_verify_phase4.sql — READ-ONLY. Run AFTER the five Phase 4 migrations.
-- =============================================================================
-- Every row should show PASS. Changes: NONE.
-- =============================================================================

with f(sig) as (
  values ('public.query_posts(uuid,uuid,text,text,text,text,integer,timestamptz,uuid,integer)'),
         ('public.search_profiles(text,integer,integer,text)'),
         ('public.search_hashtags(text,integer,text)'),
         ('public.get_hashtag(text)'),
         ('public.follower_count(uuid)'),
         ('public.get_trending_hashtags(integer)'),
         ('public.get_people_suggestions(integer,bigint,uuid)'),
         ('public.search_tsquery(text)'),
         ('public.get_posts(uuid,uuid,text,timestamptz,uuid,integer,text)'),
         ('public.get_suggested_people(integer)')
),
-- definer functions that read across users and the Phase 3 helper each must apply
d(sig, helper) as (
  values ('public.query_posts(uuid,uuid,text,text,text,text,integer,timestamptz,uuid,integer)', 'can_view_author_content'),
         ('public.search_profiles(text,integer,integer,text)', 'can_see_profile'),
         ('public.search_hashtags(text,integer,text)', 'can_view_author_content'),
         ('public.get_hashtag(text)', 'can_view_author_content'),
         ('public.follower_count(uuid)', 'can_see_profile'),
         ('public.get_trending_hashtags(integer)', 'can_view_author_content'),
         ('public.get_people_suggestions(integer,bigint,uuid)', 'is_blocked_between')
),
checks as (
  select 1 as ord, 'search indexes present (profiles full-text + username prefix, hashtag prefix, posts full-text)' as check_name,
         to_regclass('public.profiles_search_idx') is not null and to_regclass('public.profiles_username_prefix_idx') is not null
         and to_regclass('public.hashtags_tag_prefix_idx') is not null and to_regclass('public.posts_search_idx') is not null as ok,
         '' as detail
  union all
  select 2, 'Phase 4 RPCs callable by signed-in users only',
         not exists (select 1 from f where to_regprocedure(f.sig) is null
                                        or not has_function_privilege('authenticated', f.sig, 'EXECUTE')
                                        or has_function_privilege('anon', f.sig, 'EXECUTE')),
         coalesce((select string_agg(f.sig, ', ') from f where to_regprocedure(f.sig) is null
                       or not has_function_privilege('authenticated', f.sig, 'EXECUTE')
                       or has_function_privilege('anon', f.sig, 'EXECUTE')), '')
  union all
  select 3, 'cross-user functions apply the shared Phase 3 helper and pin search_path',
         not exists (select 1 from d join pg_proc p on p.oid = to_regprocedure(d.sig)
                      where not p.prosecdef or p.prosrc not like '%' || d.helper || '%'
                         or not coalesce(p.proconfig @> array['search_path=""'], false))
         and (select count(*) = 7 from d where to_regprocedure(d.sig) is not null),
         coalesce((select string_agg(d.sig, ', ') from d join pg_proc p on p.oid = to_regprocedure(d.sig)
                    where not p.prosecdef or p.prosrc not like '%' || d.helper || '%'
                       or not coalesce(p.proconfig @> array['search_path=""'], false)), '')
  union all
  select 4, 'query/search functions plan with real values (plan_cache_mode)',
         (select count(*) = 3 from pg_proc p
           where p.oid in (to_regprocedure('public.query_posts(uuid,uuid,text,text,text,text,integer,timestamptz,uuid,integer)'),
                           to_regprocedure('public.search_profiles(text,integer,integer,text)'),
                           to_regprocedure('public.search_hashtags(text,integer,text)'))
             and p.proconfig @> array['plan_cache_mode=force_custom_plan']),
         ''
  union all
  select 5, 'Phase 3 contracts unchanged (get_posts / get_suggested_people columns)',
         pg_get_function_result(to_regprocedure('public.get_posts(uuid,uuid,text,timestamptz,uuid,integer,text)'))
           = 'TABLE(id uuid, author_id uuid, author_username text, author_display_name text, author_avatar_path text, type text, category text, title text, body text, location text, event_at timestamp with time zone, like_count integer, comment_count integer, created_at timestamp with time zone, updated_at timestamp with time zone, media_path text, media_width integer, media_height integer, liked_by_me boolean, saved_by_me boolean)'
         and pg_get_function_result(to_regprocedure('public.get_suggested_people(integer)'))
           = 'TABLE(id uuid, username text, display_name text, avatar_path text, is_private boolean, follower_count integer)',
         ''
  union all
  select 6, 'search input cannot inject query operators',
         public.search_tsquery($q$Clim'):*|!&<-> JUS$q$)::text = $q$'clim':* & 'jus':*$q$
         and public.search_tsquery('!!! ### ...') is null
         and public.search_tsquery(null) is null,
         coalesce(public.search_tsquery($q$Clim'):*|!&<-> JUS$q$)::text, 'null')
  union all
  select 7, 'trending rule documented on the function (D39)',
         coalesce(obj_description(to_regprocedure('public.get_trending_hashtags(integer)'), 'pg_proc'), '') like '%3·posts + likes + 2·comments%',
         ''
  union all
  select 8, 'is_blocked_between still not callable through the API',
         not has_function_privilege('authenticated', 'public.is_blocked_between(uuid,uuid)', 'EXECUTE'),
         ''
)
select check_name, case when ok then 'PASS' else 'FAIL' end as status, coalesce(detail, '') as detail
from checks
order by ord;
