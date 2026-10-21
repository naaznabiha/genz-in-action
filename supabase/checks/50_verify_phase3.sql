-- =============================================================================
-- 50_verify_phase3.sql — READ-ONLY. Run AFTER the ten Phase 3 migrations.
-- =============================================================================
-- Every row should show PASS. Changes: NONE.
-- =============================================================================

with t(name) as (
  values ('follows'), ('follow_requests'), ('blocks'), ('posts'), ('post_media'), ('hashtags'),
         ('post_hashtags'), ('post_likes'), ('post_saves'), ('comments'), ('notifications')
),
f(sig) as (
  values ('public.create_post(text,text,text,text,text,timestamptz,text,integer,integer)'),
         ('public.update_post(uuid,text,text,text,text,text,timestamptz,text,integer,integer)'),
         ('public.get_posts(uuid,uuid,text,timestamptz,uuid,integer,text)'),
         ('public.follow_user(uuid)'), ('public.unfollow_user(uuid)'),
         ('public.accept_follow_request(uuid)'), ('public.reject_follow_request(uuid)'),
         ('public.block_user(uuid)'), ('public.unblock_user(uuid)'),
         ('public.get_profile_summary(uuid)'), ('public.get_my_follow_requests()'),
         ('public.get_my_blocked_users()'), ('public.get_suggested_people(integer)')
),
checks as (
  select 1 as ord, 'all 11 Phase 3 tables exist with RLS on' as check_name,
         (select count(*) = 11 from t join pg_class c on c.oid = to_regclass('public.' || t.name) where c.relrowsecurity) as ok,
         (select string_agg(t.name, ', ') from t where to_regclass('public.' || t.name) is null) as detail
  union all
  select 2, 'anon has no privileges on Phase 3 tables',
         not exists (select 1 from t where has_table_privilege('anon', 'public.' || t.name, 'SELECT')
                                        or has_table_privilege('anon', 'public.' || t.name, 'INSERT')),
         ''
  union all
  select 3, 'API cannot write follows / requests / blocks / hashtags / notifications directly',
         not exists (select 1 from unnest(array['follows', 'follow_requests', 'blocks', 'hashtags', 'post_hashtags', 'notifications']) x
                      where has_table_privilege('authenticated', 'public.' || x, 'INSERT')
                         or has_table_privilege('authenticated', 'public.' || x, 'DELETE')),
         ''
  union all
  select 4, 'API cannot write post counters or timestamps',
         not has_column_privilege('authenticated', 'public.posts', 'like_count', 'UPDATE')
         and not has_column_privilege('authenticated', 'public.posts', 'comment_count', 'UPDATE')
         and not has_column_privilege('authenticated', 'public.posts', 'like_count', 'INSERT')
         and not has_column_privilege('authenticated', 'public.posts', 'created_at', 'INSERT')
         and not has_column_privilege('authenticated', 'public.posts', 'updated_at', 'UPDATE')
         and not has_column_privilege('authenticated', 'public.posts', 'author_id', 'UPDATE'),
         ''
  union all
  select 5, 'counter triggers present',
         exists (select 1 from pg_trigger where tgname = 'post_likes_count')
         and exists (select 1 from pg_trigger where tgname = 'comments_count'),
         ''
  union all
  select 6, 'one like per user per post (primary key)',
         exists (select 1 from pg_constraint where conrelid = 'public.post_likes'::regclass and contype = 'p'),
         ''
  union all
  select 7, 'deleting a post cascades likes/saves/comments/hashtags/media',
         (select count(*) = 5 from pg_constraint c
           where c.contype = 'f' and c.confrelid = 'public.posts'::regclass and c.confdeltype = 'c'
             and c.conrelid in ('public.post_likes'::regclass, 'public.post_saves'::regclass, 'public.comments'::regclass,
                                'public.post_hashtags'::regclass, 'public.post_media'::regclass)),
         ''
  union all
  select 8, 'authored content is not cascaded away with an account (posts/comments RESTRICT)',
         exists (select 1 from pg_constraint where conrelid = 'public.posts'::regclass and contype = 'f'
                  and confrelid = 'public.profiles'::regclass and confdeltype = 'r')
         and exists (select 1 from pg_constraint where conrelid = 'public.comments'::regclass and contype = 'f'
                  and confrelid = 'public.profiles'::regclass and confdeltype = 'r'),
         ''
  union all
  select 9, 'shared visibility helpers exist and are used by post/profile policies',
         exists (select 1 from pg_policies where tablename = 'posts' and policyname = 'posts_select_visible' and qual like '%can_view_author_content%')
         and exists (select 1 from pg_policies where tablename = 'profiles' and policyname = 'profiles_select_authenticated' and qual like '%can_see_profile%'),
         'If the profiles row FAILS after re-running a Phase 1 file: re-run 20261021120100_visibility_helpers.sql'
  union all
  select 10, 'post-media bucket: PRIVATE, 5 MB, JPEG/PNG',
         exists (select 1 from storage.buckets b where b.id = 'post-media' and not b.public and b.file_size_limit = 5242880
                  and b.allowed_mime_types @> array['image/jpeg', 'image/png'] and array_length(b.allowed_mime_types, 1) = 2),
         coalesce((select 'public=' || public || ', limit=' || coalesce(file_size_limit::text, 'none') from storage.buckets where id = 'post-media'), 'bucket missing')
  union all
  select 11, 'post-media insert/select/delete policies, no update policy',
         (select count(*) = 3 from pg_policies where schemaname = 'storage' and tablename = 'objects'
            and policyname in ('post_media_insert_own_folder', 'post_media_select_allowed', 'post_media_delete_own_folder'))
         and not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                          and cmd in ('UPDATE', 'ALL') and coalesce(qual, '') || coalesce(with_check, '') ilike '%post-media%'),
         ''
  union all
  select 12, 'Phase 3 RPCs callable by signed-in users only',
         not exists (select 1 from f where not has_function_privilege('authenticated', f.sig, 'EXECUTE')
                                        or has_function_privilege('anon', f.sig, 'EXECUTE')),
         (select string_agg(f.sig, ', ') from f where not has_function_privilege('authenticated', f.sig, 'EXECUTE')
                                                   or has_function_privilege('anon', f.sig, 'EXECUTE'))
  union all
  select 13, 'trusted writers are not callable by the API',
         not has_function_privilege('authenticated', 'public.create_notification(uuid,uuid,text,text,uuid)', 'EXECUTE')
         and not has_function_privilege('authenticated', 'public.record_activity_event(uuid,text,text,text,text,jsonb)', 'EXECUTE'),
         ''
  union all
  select 14, 'activity event types for posts/likes/comments/follows exist',
         (select count(*) = 4 from public.activity_event_types
           where id in ('post_created', 'post_liked', 'comment_created', 'user_followed')),
         ''
  union all
  select 15, 'social triggers present (posts, likes, comments, follows, requests)',
         (select count(*) = 10 from pg_trigger where tgname in (
            'posts_after_insert_social', 'posts_after_delete_social', 'post_likes_after_insert_social',
            'post_likes_after_delete_social', 'comments_after_insert_social', 'comments_after_delete_social',
            'follows_after_insert_social', 'follows_after_delete_social', 'follow_requests_after_insert_social',
            'follow_requests_after_delete_social')),
         ''
  union all
  select 16, 'hashtag sync + edited-at triggers present',
         exists (select 1 from pg_trigger where tgname = 'posts_sync_hashtags')
         and exists (select 1 from pg_trigger where tgname = 'posts_set_edited_at')
         and exists (select 1 from pg_trigger where tgname = 'comments_set_edited_at'),
         ''
  union all
  select 17, 'feed indexes for cursor pagination',
         to_regclass('public.posts_feed_idx') is not null and to_regclass('public.posts_author_feed_idx') is not null
         and to_regclass('public.posts_category_feed_idx') is not null,
         ''
  union all
  select 18, 'private → public accepts pending requests (trigger present)',
         exists (select 1 from pg_trigger where tgname = 'profiles_privacy_changed'),
         ''
)
select check_name, case when ok then 'PASS' else 'FAIL' end as status, coalesce(detail, '') as detail
from checks
order by ord;
