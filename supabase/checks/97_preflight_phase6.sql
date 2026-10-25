-- =============================================================================
-- 97_preflight_phase6.sql — READ-ONLY. Run BEFORE the eight Phase 6 migrations.
-- =============================================================================
-- OK = ready. MISSING = a Phase 3–5 prerequisite is absent (apply those first).
-- EXISTS = a Phase 6 object already exists — fine if you ran a Phase 6 file
-- before (every Phase 6 file is safe to re-run). INFO = for your records.
-- Changes: NONE.
-- =============================================================================

with prereq(ord, label, present) as (
  values
    (1, 'Phase 3 shared helpers (can_see_profile, can_view_author_content, is_blocked_between)',
        to_regprocedure('public.can_see_profile(uuid)') is not null
        and to_regprocedure('public.can_view_author_content(uuid)') is not null
        and to_regprocedure('public.is_blocked_between(uuid,uuid)') is not null),
    (2, 'Phase 3 posts, comments, likes, saves, post-media',
        to_regclass('public.posts') is not null and to_regclass('public.comments') is not null
        and to_regclass('public.post_likes') is not null and to_regclass('public.post_saves') is not null
        and exists (select 1 from storage.buckets where id = 'post-media')),
    (3, 'Phase 4 Discovery readers (query_posts, hashtags)',
        to_regprocedure('public.query_posts(uuid,uuid,text,text,text,text,integer,timestamptz,uuid,integer)') is not null
        and to_regprocedure('public.search_hashtags(text,integer,text)') is not null),
    (4, 'Phase 5 notifications (create_notification, get_notifications, get_my_post_list)',
        to_regprocedure('public.create_notification(uuid,uuid,text,text,uuid)') is not null
        and to_regprocedure('public.get_notifications(timestamptz,text,integer)') is not null
        and to_regprocedure('public.get_my_post_list(text,timestamptz,uuid,integer)') is not null),
    (5, 'notification type / target checks exist (Phase 6 widens them)',
        exists (select 1 from pg_constraint where conname = 'notifications_type_valid')
        and exists (select 1 from pg_constraint where conname = 'notifications_target_type_valid'))
),
checks as (
  select ord, label as check_name, case when present then 'OK' else 'MISSING' end as status, '' as detail
    from prereq
  union all
  select 10, 'tables with Phase 6 names',
         case when to_regclass('public.communities') is not null or to_regclass('public.community_members') is not null
              then 'EXISTS' else 'OK' end,
         coalesce((select string_agg(c.relname, ', ' order by c.relname) from pg_class c
                    join pg_namespace n on n.oid = c.relnamespace
                   where n.nspname = 'public' and c.relkind = 'r'
                     and (c.relname = 'communities' or c.relname like 'community\_%')), '')
  union all
  select 11, 'posts.community_id column',
         case when exists (select 1 from information_schema.columns
                            where table_schema = 'public' and table_name = 'posts' and column_name = 'community_id')
              then 'EXISTS' else 'OK' end, ''
  union all
  select 12, 'storage buckets community-media / community-images',
         case when exists (select 1 from storage.buckets where id in ('community-media', 'community-images'))
              then 'EXISTS' else 'OK' end, ''
  union all
  select 13, 'Realtime publication (optional; live discussion)',
         case when exists (select 1 from pg_publication where pubname = 'supabase_realtime') then 'OK' else 'INFO' end,
         case when exists (select 1 from pg_publication where pubname = 'supabase_realtime')
              then 'community_messages and community_message_pins will be added'
              else 'no supabase_realtime publication: the discussion refreshes on pull / focus only' end
  union all
  select 30, 'data', 'INFO',
         (select count(*) from public.profiles)::text || ' profiles, '
         || (select count(*) from public.posts)::text || ' posts, '
         || (select count(*) from public.notifications)::text || ' notifications'
)
select check_name, status, detail from checks order by ord;
