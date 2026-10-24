-- =============================================================================
-- 94_verify_phase5.sql — READ-ONLY. Run AFTER the four Phase 5 migrations.
-- =============================================================================
-- Every row should show PASS. Changes: NONE.
-- =============================================================================

with f(sig) as (
  values ('public.get_notifications(timestamptz,text,integer)'),
         ('public.get_unread_notification_count()'),
         ('public.mark_notification_read(text)'),
         ('public.mark_all_notifications_read()'),
         ('public.get_my_post_list(text,timestamptz,uuid,integer)')
),
checks as (
  select 1 as ord, 'Phase 5 RPCs callable by signed-in users only' as check_name,
         not exists (select 1 from f where to_regprocedure(f.sig) is null
                                        or not has_function_privilege('authenticated', f.sig, 'EXECUTE')
                                        or has_function_privilege('anon', f.sig, 'EXECUTE')) as ok,
         coalesce((select string_agg(f.sig, ', ') from f where to_regprocedure(f.sig) is null
                       or not has_function_privilege('authenticated', f.sig, 'EXECUTE')
                       or has_function_privilege('anon', f.sig, 'EXECUTE')), '') as detail
  union all
  select 2, 'notifications: the app can only read and set read_at (no insert / delete / other columns)',
         has_table_privilege('authenticated', 'public.notifications', 'SELECT')
         and not has_table_privilege('authenticated', 'public.notifications', 'INSERT')
         and not has_table_privilege('authenticated', 'public.notifications', 'DELETE')
         and has_column_privilege('authenticated', 'public.notifications', 'read_at', 'UPDATE')
         and not has_column_privilege('authenticated', 'public.notifications', 'recipient_id', 'UPDATE')
         and not has_column_privilege('authenticated', 'public.notifications', 'type', 'UPDATE')
         and not has_table_privilege('anon', 'public.notifications', 'SELECT'),
         ''
  union all
  select 3, 'notification policies: recipient only, blocked actors hidden',
         exists (select 1 from pg_policies where tablename = 'notifications' and policyname = 'notifications_select_own'
                  and qual like '%recipient_id%' and qual like '%can_see_profile%')
         and exists (select 1 from pg_policies where tablename = 'notifications' and policyname = 'notifications_update_own'
                  and qual like '%recipient_id%' and with_check like '%recipient_id%'),
         ''
  union all
  select 4, 'only trusted database logic creates notifications',
         not has_function_privilege('authenticated', 'public.create_notification(uuid,uuid,text,text,uuid)', 'EXECUTE')
         and not has_function_privilege('anon', 'public.create_notification(uuid,uuid,text,text,uuid)', 'EXECUTE'),
         ''
  union all
  select 5, 'readers apply the shared helpers and pin search_path',
         (select count(*) = 3 from pg_proc p
           where p.oid in (to_regprocedure('public.get_notifications(timestamptz,text,integer)'),
                           to_regprocedure('public.get_unread_notification_count()'),
                           to_regprocedure('public.get_my_post_list(text,timestamptz,uuid,integer)'))
             and p.prosecdef
             and coalesce(p.proconfig @> array['search_path=""'], false)
             and (p.prosrc like '%can_see_profile%' or p.prosrc like '%can_view_author_content%'))
         and (select count(*) = 2 from pg_proc p
               where p.oid in (to_regprocedure('public.mark_notification_read(text)'),
                               to_regprocedure('public.mark_all_notifications_read()'))
                 and not p.prosecdef and coalesce(p.proconfig @> array['search_path=""'], false)),
         ''
  union all
  select 6, 'unread-count index present',
         to_regclass('public.notifications_unread_idx') is not null,
         ''
  union all
  select 8, 'a repeated accepted follow request notifies again (resurface fix)',
         coalesce((select p.prosrc like '%do update set created_at = now(), read_at = null%' from pg_proc p
                    where p.oid = to_regprocedure('public.create_notification(uuid,uuid,text,text,uuid)')), false),
         ''
  union all
  select 7, 'Realtime: notifications published (or no Realtime on this database)',
         not exists (select 1 from pg_publication where pubname = 'supabase_realtime')
         or exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
                     and schemaname = 'public' and tablename = 'notifications'),
         case when exists (select 1 from pg_publication where pubname = 'supabase_realtime') then 'published' else 'no publication here' end
)
select check_name, case when ok then 'PASS' else 'FAIL' end as status, coalesce(detail, '') as detail
from checks
order by ord;
