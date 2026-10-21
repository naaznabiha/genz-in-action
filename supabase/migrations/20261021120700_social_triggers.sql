-- =============================================================================
-- Migration 20261021120700_social_triggers
-- Phase 3 · Step 8 of 10
-- =============================================================================
-- Creates : • activity event types: post_created, post_liked, comment_created,
--             user_followed (rows in public.activity_event_types)
--           • triggers that record activity events and create notifications
--             when a post, like, comment, follow or follow request happens,
--             and clean up notifications when the source is removed.
-- Depends : Phase 2 activity ledger, 20261021120500, 20261021120600.
-- Safe to re-run : yes (event types ON CONFLICT DO NOTHING; functions/triggers
--           CREATE OR REPLACE).
-- Destructive    : no. (The cleanup triggers delete only notifications whose
--           source row is being deleted.)
-- Spec    : §12 "The client must not directly create activity_events or
--           trusted notification events. Generate them … using database
--           triggers", §13, M5 "add action-specific notification/activity
--           triggers alongside each action".
--
-- Ledger notes (impact formula still unapproved — docs/impact-scoring.md):
--   • Events are append-only and are NOT removed when a like/post/comment is
--     undone or deleted (history stays honest).
--   • Like and follow events carry a dedupe key, so like→unlike→like or
--     follow→unfollow→follow records one event, not many (anti-gaming).
--   • No weights exist, so none of this produces points yet.
-- =============================================================================

insert into public.activity_event_types (id, label, description) values
  ('post_created',    'Created a post',    'Author published a post.'),
  ('post_liked',      'Liked a post',      'User liked someone''s post (once per post).'),
  ('comment_created', 'Commented',         'User commented on a post.'),
  ('user_followed',   'Followed someone',  'User started following someone (once per pair).')
on conflict (id) do nothing;

-- ---------------------------------------------------------------- posts
create or replace function public.on_post_created()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.record_activity_event(new.author_id, 'post_created', 'posts', new.id::text, 'post:' || new.id);
  return null;
end;
$$;

create or replace function public.on_post_deleted()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.notifications where target_type = 'post' and target_id = old.id;
  return null;
end;
$$;

create or replace trigger posts_after_insert_social
  after insert on public.posts for each row execute function public.on_post_created();
create or replace trigger posts_after_delete_social
  after delete on public.posts for each row execute function public.on_post_deleted();

-- ---------------------------------------------------------------- likes
create or replace function public.on_post_liked()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  author uuid;
begin
  select p.author_id into author from public.posts p where p.id = new.post_id;
  if new.user_id <> author then
    perform public.record_activity_event(new.user_id, 'post_liked', 'post_likes', new.post_id::text,
                                         'like:' || new.post_id || ':' || new.user_id);
  end if;
  perform public.create_notification(author, new.user_id, 'like', 'post', new.post_id);
  return null;
end;
$$;

create or replace function public.on_post_unliked()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.notifications
   where type = 'like' and actor_id = old.user_id and target_type = 'post'
     and target_id = old.post_id and read_at is null;
  return null;
end;
$$;

create or replace trigger post_likes_after_insert_social
  after insert on public.post_likes for each row execute function public.on_post_liked();
create or replace trigger post_likes_after_delete_social
  after delete on public.post_likes for each row execute function public.on_post_unliked();

-- ---------------------------------------------------------------- comments
create or replace function public.on_comment_created()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  author uuid;
begin
  select p.author_id into author from public.posts p where p.id = new.post_id;
  perform public.record_activity_event(new.author_id, 'comment_created', 'comments', new.id::text, 'comment:' || new.id);
  perform public.create_notification(author, new.author_id, 'comment', 'comment', new.id);
  return null;
end;
$$;

create or replace function public.on_comment_deleted()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.notifications where target_type = 'comment' and target_id = old.id;
  return null;
end;
$$;

create or replace trigger comments_after_insert_social
  after insert on public.comments for each row execute function public.on_comment_created();
create or replace trigger comments_after_delete_social
  after delete on public.comments for each row execute function public.on_comment_deleted();

-- ---------------------------------------------------------------- follows
-- When a follow is created by accepting a request, the accept function sets
-- genz.follow_via_accept so the target is not told "X followed you" (they just
-- approved it); the requester gets follow_accepted instead (sent by the RPC).
create or replace function public.on_follow_created()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.record_activity_event(new.follower_id, 'user_followed', 'follows', new.following_id::text,
                                       'follow:' || new.follower_id || ':' || new.following_id);
  if coalesce(current_setting('genz.follow_via_accept', true), '') <> '1' then
    perform public.create_notification(new.following_id, new.follower_id, 'follow', 'profile', new.follower_id);
  end if;
  return null;
end;
$$;

create or replace function public.on_follow_deleted()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.notifications
   where type = 'follow' and recipient_id = old.following_id and actor_id = old.follower_id and read_at is null;
  return null;
end;
$$;

create or replace trigger follows_after_insert_social
  after insert on public.follows for each row execute function public.on_follow_created();
create or replace trigger follows_after_delete_social
  after delete on public.follows for each row execute function public.on_follow_deleted();

-- ---------------------------------------------------------------- follow requests
create or replace function public.on_follow_request_created()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.create_notification(new.target_id, new.requester_id, 'follow_request', 'profile', new.requester_id);
  return null;
end;
$$;

create or replace function public.on_follow_request_deleted()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.notifications
   where type = 'follow_request' and recipient_id = old.target_id and actor_id = old.requester_id;
  return null;
end;
$$;

create or replace trigger follow_requests_after_insert_social
  after insert on public.follow_requests for each row execute function public.on_follow_request_created();
create or replace trigger follow_requests_after_delete_social
  after delete on public.follow_requests for each row execute function public.on_follow_request_deleted();

-- None of these trigger functions may be called through the API.
revoke execute on function public.on_post_created() from public, anon, authenticated;
revoke execute on function public.on_post_deleted() from public, anon, authenticated;
revoke execute on function public.on_post_liked() from public, anon, authenticated;
revoke execute on function public.on_post_unliked() from public, anon, authenticated;
revoke execute on function public.on_comment_created() from public, anon, authenticated;
revoke execute on function public.on_comment_deleted() from public, anon, authenticated;
revoke execute on function public.on_follow_created() from public, anon, authenticated;
revoke execute on function public.on_follow_deleted() from public, anon, authenticated;
revoke execute on function public.on_follow_request_created() from public, anon, authenticated;
revoke execute on function public.on_follow_request_deleted() from public, anon, authenticated;
