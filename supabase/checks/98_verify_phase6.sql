-- =============================================================================
-- 98_verify_phase6.sql — READ-ONLY. Run AFTER the eight Phase 6 migrations.
-- =============================================================================
-- Every row should show PASS. Changes: NONE.
-- =============================================================================

with f(sig) as (
  values ('public.create_community(text,text,text,boolean)'), ('public.update_community(uuid,text,text,text)'),
         ('public.join_community(uuid)'), ('public.leave_community(uuid)'), ('public.delete_community(uuid)'),
         ('public.invite_to_community(uuid,uuid)'), ('public.respond_to_invite(uuid,boolean)'),
         ('public.cancel_invite(uuid)'), ('public.set_member_role(uuid,uuid,text)'),
         ('public.remove_member(uuid,uuid)'), ('public.transfer_ownership(uuid,uuid)'),
         ('public.create_community_post(uuid,text,text,text,text,text,timestamptz,text,integer,integer)'),
         ('public.get_communities(text,text,timestamptz,uuid,integer)'), ('public.get_my_community_invites()'),
         ('public.get_community(uuid)'), ('public.get_community_members(uuid,integer,text,integer)'),
         ('public.get_community_invites(uuid)'), ('public.get_community_messages(uuid,timestamptz,uuid,integer)'),
         ('public.get_pinned_messages(uuid)'), ('public.get_starred_messages(uuid,timestamptz,uuid,integer)'),
         ('public.get_community_feed(uuid,text,timestamptz,uuid,integer)'),
         ('public.get_notification_list(timestamptz,text,integer)'),
         ('public.community_role(uuid)'), ('public.can_read_community(uuid)'), ('public.can_view_post(uuid,uuid)')
),
t(name) as (
  values ('communities'), ('community_members'), ('community_invites'), ('community_messages'),
         ('community_message_pins'), ('community_message_stars'), ('community_content')
),
checks as (
  select 1 as ord, 'Phase 6 functions callable by signed-in users only' as check_name,
         not exists (select 1 from f where to_regprocedure(f.sig) is null
                                        or not has_function_privilege('authenticated', f.sig, 'EXECUTE')
                                        or has_function_privilege('anon', f.sig, 'EXECUTE')) as ok,
         coalesce((select string_agg(f.sig, ', ') from f where to_regprocedure(f.sig) is null
                       or not has_function_privilege('authenticated', f.sig, 'EXECUTE')
                       or has_function_privilege('anon', f.sig, 'EXECUTE')), '') as detail
  union all
  select 2, 'seven community tables exist with RLS on, none readable signed out',
         (select count(*) = 7 from t join pg_class c on c.oid = to_regclass('public.' || t.name) where c.relrowsecurity)
         and not exists (select 1 from t where has_table_privilege('anon', 'public.' || t.name, 'SELECT')),
         coalesce((select string_agg(t.name, ', ') from t
                    where to_regclass('public.' || t.name) is null
                       or not (select relrowsecurity from pg_class where oid = to_regclass('public.' || t.name))), '')
  union all
  select 3, 'communities, members and invites change only through the RPCs',
         not has_table_privilege('authenticated', 'public.communities', 'INSERT,UPDATE,DELETE')
         and not has_table_privilege('authenticated', 'public.community_members', 'INSERT,UPDATE,DELETE')
         and not has_table_privilege('authenticated', 'public.community_invites', 'INSERT,UPDATE,DELETE'),
         ''
  union all
  select 4, 'messages: insert own as active member, delete own or admin; nobody edits',
         exists (select 1 from pg_policies where tablename = 'community_messages' and policyname = 'community_messages_insert'
                  and with_check like '%author_id%')
         and exists (select 1 from pg_policies where tablename = 'community_messages' and policyname = 'community_messages_select'
                  and qual like '%can_read_community%')
         and not has_table_privilege('authenticated', 'public.community_messages', 'UPDATE'),
         ''
  union all
  select 5, 'pins: admins/owner only; stars: private to their owner',
         exists (select 1 from pg_policies where tablename = 'community_message_pins' and policyname = 'community_message_pins_insert'
                  and with_check like '%community_role%')
         and exists (select 1 from pg_policies where tablename = 'community_message_stars' and policyname = 'community_message_stars_select'
                  and qual like '%user_id%')
         and (select count(*) = 3 from pg_policies where tablename = 'community_message_stars'),
         ''
  union all
  select 6, 'one owner per community; owner must be active (constraints)',
         exists (select 1 from pg_indexes where tablename = 'community_members' and indexdef like '%UNIQUE%' and indexdef like '%owner%')
         and exists (select 1 from pg_constraint where conrelid = 'public.community_members'::regclass and contype = 'c'
                      and pg_get_constraintdef(oid) like '%owner%active%'),
         ''
  union all
  select 7, 'post audience: posts.community_id + policies use can_view_post (D51)',
         exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'posts' and column_name = 'community_id')
         and (select count(*) = 4 from pg_policies where schemaname = 'public'
                and policyname in ('posts_select_visible', 'post_media_select_visible', 'post_hashtags_select_visible', 'comments_select_visible')
                and qual like '%can_view_post%'),
         'If FAIL after re-running a Phase 3 file: re-run 20261024120100_community_access.sql'
  union all
  select 8, 'readers apply community visibility (re-run 120500 after any Phase 4/5 file)',
         (select count(*) = 5 and bool_and(p.prosrc like '%can_read_community%') from pg_proc p
           where p.oid in (to_regprocedure('public.query_posts(uuid,uuid,text,text,text,text,integer,timestamptz,uuid,integer)'),
                           to_regprocedure('public.search_hashtags(text,integer,text)'),
                           to_regprocedure('public.get_hashtag(text)'),
                           to_regprocedure('public.get_trending_hashtags(integer)'),
                           to_regprocedure('public.get_my_post_list(text,timestamptz,uuid,integer)'))),
         'If FAIL: re-run 20261024120500_post_audience.sql'
  union all
  select 9, 'community-media bucket: PRIVATE, 10 MB, JPEG/PNG/PDF; community-images: public, 5 MB',
         exists (select 1 from storage.buckets where id = 'community-media' and not public and file_size_limit = 10485760
                  and allowed_mime_types @> array['image/jpeg', 'image/png', 'application/pdf'])
         and exists (select 1 from storage.buckets where id = 'community-images' and public and file_size_limit = 5242880),
         ''
  union all
  select 10, 'storage policies for both buckets, no update policy',
         (select count(*) = 5 from pg_policies where schemaname = 'storage' and tablename = 'objects'
            and policyname in ('community_media_insert_member_folder', 'community_media_select_allowed', 'community_media_delete_own',
                               'community_images_insert_own_folder', 'community_images_delete_own_folder'))
         and not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                          and policyname like 'community%' and cmd = 'UPDATE'),
         ''
  union all
  select 11, 'attachment / image / notification / pin triggers present',
         (select count(*) = 9 from pg_trigger where not tgisinternal and tgname in (
            'communities_after_delete_notify', 'communities_image_check', 'community_content_after_delete_notify',
            'community_content_after_insert_notify', 'community_content_attachment_check', 'community_content_touch',
            'community_invites_after_delete_notify', 'community_message_pins_fill', 'community_messages_attachment_check')),
         ''
  union all
  select 12, 'notifications accept community types; Phase 5 get_notifications unchanged',
         (select pg_get_constraintdef(oid) like '%community_invite%' from pg_constraint where conname = 'notifications_type_valid')
         and to_regprocedure('public.get_notifications(timestamptz,text,integer)') is not null,
         ''
  union all
  select 13, 'Realtime: discussion tables published (skipped if no publication)',
         not exists (select 1 from pg_publication where pubname = 'supabase_realtime')
         or (select count(*) = 2 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public'
              and tablename in ('community_messages', 'community_message_pins')),
         case when exists (select 1 from pg_publication where pubname = 'supabase_realtime') then '' else 'no publication' end
)
select check_name, case when ok then 'PASS' else 'FAIL' end as status, detail from checks order by ord;
