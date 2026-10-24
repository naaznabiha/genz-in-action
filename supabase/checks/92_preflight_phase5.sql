-- =============================================================================
-- 92_preflight_phase5.sql — READ-ONLY. Run BEFORE the four Phase 5 migrations.
-- =============================================================================
-- OK = ready. MISSING = a Phase 3/4 prerequisite is absent (apply those first).
-- EXISTS = a Phase 5 object already exists — fine if you ran a Phase 5 file
-- before (every Phase 5 file is safe to re-run). INFO = for your records.
-- Changes: NONE.
-- =============================================================================

with prereq(ord, label, present) as (
  values
    (1, 'Phase 3 notifications table + trusted writer create_notification',
        to_regclass('public.notifications') is not null
        and to_regprocedure('public.create_notification(uuid,uuid,text,text,uuid)') is not null),
    (2, 'Phase 3 notification triggers (likes, comments, follows, requests)',
        (select count(*) = 8 from pg_trigger where tgname in (
           'post_likes_after_insert_social', 'post_likes_after_delete_social', 'comments_after_insert_social',
           'comments_after_delete_social', 'follows_after_insert_social', 'follows_after_delete_social',
           'follow_requests_after_insert_social', 'follow_requests_after_delete_social'))),
    (3, 'Phase 3 saves / likes tables',
        to_regclass('public.post_saves') is not null and to_regclass('public.post_likes') is not null),
    (4, 'Phase 3 shared helpers (can_see_profile, can_view_author_content)',
        to_regprocedure('public.can_see_profile(uuid)') is not null
        and to_regprocedure('public.can_view_author_content(uuid)') is not null),
    (5, 'Phase 4 query_posts (Discovery) applied',
        to_regprocedure('public.query_posts(uuid,uuid,text,text,text,text,integer,timestamptz,uuid,integer)') is not null)
),
checks as (
  select ord, label as check_name, case when present then 'OK' else 'MISSING' end as status, '' as detail
    from prereq
  union all
  select 10, 'functions with Phase 5 names',
         case when exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                            where n.nspname = 'public'
                              and p.proname in ('get_notifications', 'get_unread_notification_count', 'mark_notification_read',
                                                'mark_all_notifications_read', 'get_my_post_list'))
              then 'EXISTS' else 'OK' end,
         ''
  union all
  select 11, 'Realtime publication (optional; live badge updates)',
         case when exists (select 1 from pg_publication where pubname = 'supabase_realtime') then 'OK' else 'INFO' end,
         case when exists (select 1 from pg_publication where pubname = 'supabase_realtime')
              then case when exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
                                       and schemaname = 'public' and tablename = 'notifications')
                        then 'notifications already published' else 'notifications will be added' end
              else 'no supabase_realtime publication: badge refreshes on app foreground only' end
  union all
  select 30, 'data', 'INFO',
         (select count(*) from public.notifications)::text || ' notifications ('
         || (select count(*) from public.notifications where read_at is null)::text || ' unread), '
         || (select count(*) from public.post_saves)::text || ' saves, '
         || (select count(*) from public.post_likes)::text || ' likes'
)
select check_name, status, detail from checks order by ord;
