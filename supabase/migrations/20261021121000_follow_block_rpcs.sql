-- =============================================================================
-- Migration 20261021121000_follow_block_rpcs
-- Phase 3 · Step 10 of 10 (Phase 3b — social graph and privacy)
-- =============================================================================
-- Creates : the ONLY write paths for follows / follow_requests / blocks, plus
--           read helpers that need to see across RLS safely:
--             follow_user, unfollow_user, accept_follow_request,
--             reject_follow_request, block_user, unblock_user,
--             get_profile_summary, get_my_follow_requests, get_my_blocked_users,
--             get_suggested_people
--           and a trigger: switching an account from private to public accepts
--           its pending follow requests.
-- Depends : 20261021120000 … 20261021120700.
-- Safe to re-run : yes (CREATE OR REPLACE).
-- Destructive    : no schema/data removal. block_user deletes follows and
--           follow requests between the two users — that is the spec rule.
-- Spec    : §5.6, §11 (public follow immediate, private follow = request,
--           unfollow removes, blocking takes precedence and removes follows and
--           requests in both directions, blocked pairs cannot follow/request),
--           FR-10, FR-11, FR-12, FR-20.
--
-- All write functions are SECURITY DEFINER (they must touch rows of two users)
-- and act ONLY for auth.uid(); they validate every rule themselves.
-- Relationship states returned to the app: 'self', 'following', 'requested',
-- 'none', 'blocked_by_me'. A user who blocked the caller is reported as not
-- found, so the blocked person cannot detect the block.
-- =============================================================================

-- ---------------------------------------------------------------- helpers
create or replace function public.relationship_with(p_other uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select auth.uid()) = p_other then 'self'
    when exists (select 1 from public.blocks b where b.blocker_id = (select auth.uid()) and b.blocked_id = p_other) then 'blocked_by_me'
    when exists (select 1 from public.follows f where f.follower_id = (select auth.uid()) and f.following_id = p_other) then 'following'
    when exists (select 1 from public.follow_requests r where r.requester_id = (select auth.uid()) and r.target_id = p_other) then 'requested'
    else 'none'
  end;
$$;

-- ---------------------------------------------------------------- follow / unfollow
create or replace function public.follow_user(p_target uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  target_private boolean;
begin
  if uid is null then
    raise exception using errcode = '42501', message = 'GENZ_NOT_SIGNED_IN: sign in to follow people';
  end if;
  if p_target = uid then
    raise exception using errcode = '22023', message = 'GENZ_FOLLOW_SELF: you cannot follow yourself';
  end if;
  select p.is_private into target_private from public.profiles p where p.id = p_target;
  if target_private is null or public.is_blocked_between(uid, p_target) then
    -- Same answer for "does not exist" and "blocked": no block detection.
    raise exception using errcode = 'PT404', message = 'GENZ_USER_NOT_FOUND: that account is not available';
  end if;

  if exists (select 1 from public.follows f where f.follower_id = uid and f.following_id = p_target) then
    return 'following';
  end if;

  if target_private then
    insert into public.follow_requests (requester_id, target_id) values (uid, p_target)
    on conflict do nothing;
    return 'requested';
  end if;

  insert into public.follows (follower_id, following_id) values (uid, p_target)
  on conflict do nothing;
  return 'following';
end;
$$;

-- Unfollow, or cancel a pending request. Idempotent.
create or replace function public.unfollow_user(p_target uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception using errcode = '42501', message = 'GENZ_NOT_SIGNED_IN: sign in first';
  end if;
  delete from public.follows where follower_id = uid and following_id = p_target;
  delete from public.follow_requests where requester_id = uid and target_id = p_target;
  return 'none';
end;
$$;

create or replace function public.accept_follow_request(p_requester uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception using errcode = '42501', message = 'GENZ_NOT_SIGNED_IN: sign in first';
  end if;
  delete from public.follow_requests where requester_id = p_requester and target_id = uid;
  if not found then
    raise exception using errcode = 'PT404', message = 'GENZ_REQUEST_NOT_FOUND: that request no longer exists';
  end if;
  if public.is_blocked_between(uid, p_requester) then
    return;   -- request removed; a block wins
  end if;
  perform set_config('genz.follow_via_accept', '1', true);
  insert into public.follows (follower_id, following_id) values (p_requester, uid)
  on conflict do nothing;
  perform set_config('genz.follow_via_accept', '', true);
  perform public.create_notification(p_requester, uid, 'follow_accepted', 'profile', uid);
end;
$$;

create or replace function public.reject_follow_request(p_requester uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception using errcode = '42501', message = 'GENZ_NOT_SIGNED_IN: sign in first';
  end if;
  delete from public.follow_requests where requester_id = p_requester and target_id = uid;
end;
$$;

-- Switching private → public: pending requests become follows (they were
-- waiting only because the account was private).
create or replace function public.on_profile_privacy_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  if old.is_private and not new.is_private then
    for r in delete from public.follow_requests where target_id = new.id returning requester_id loop
      if not public.is_blocked_between(new.id, r.requester_id) then
        perform set_config('genz.follow_via_accept', '1', true);
        insert into public.follows (follower_id, following_id) values (r.requester_id, new.id)
        on conflict do nothing;
        perform set_config('genz.follow_via_accept', '', true);
        perform public.create_notification(r.requester_id, new.id, 'follow_accepted', 'profile', new.id);
      end if;
    end loop;
  end if;
  return null;
end;
$$;

create or replace trigger profiles_privacy_changed
  after update of is_private on public.profiles
  for each row execute function public.on_profile_privacy_changed();

-- ---------------------------------------------------------------- block / unblock
create or replace function public.block_user(p_target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception using errcode = '42501', message = 'GENZ_NOT_SIGNED_IN: sign in first';
  end if;
  if p_target = uid then
    raise exception using errcode = '22023', message = 'GENZ_BLOCK_SELF: you cannot block yourself';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_target) then
    raise exception using errcode = 'PT404', message = 'GENZ_USER_NOT_FOUND: that account is not available';
  end if;

  insert into public.blocks (blocker_id, blocked_id) values (uid, p_target)
  on conflict do nothing;

  -- Spec §11: remove follows and pending requests in BOTH directions.
  delete from public.follows
   where (follower_id = uid and following_id = p_target) or (follower_id = p_target and following_id = uid);
  delete from public.follow_requests
   where (requester_id = uid and target_id = p_target) or (requester_id = p_target and target_id = uid);
  -- Notifications between the pair are no longer meaningful.
  delete from public.notifications
   where (recipient_id = uid and actor_id = p_target) or (recipient_id = p_target and actor_id = uid);
end;
$$;

create or replace function public.unblock_user(p_target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception using errcode = '42501', message = 'GENZ_NOT_SIGNED_IN: sign in first';
  end if;
  delete from public.blocks where blocker_id = uid and blocked_id = p_target;
  -- Previous follows are NOT restored (spec: block removed them).
end;
$$;

-- ---------------------------------------------------------------- read helpers
-- Profile header for any user. No row = not found OR they blocked the caller.
-- If the CALLER blocked them, identity is returned with relationship
-- 'blocked_by_me' (so the blocker can unblock), and no content access.
create or replace function public.get_profile_summary(p_user_id uuid)
returns table (
  id                uuid,
  username          text,
  display_name      text,
  bio               text,
  avatar_path       text,
  location          text,
  is_private        boolean,
  created_at        timestamptz,
  follower_count    integer,
  following_count   integer,
  post_count        integer,
  total_actions     integer,
  relationship      text,
  can_view_content  boolean
)
language sql
stable
security definer          -- counts must include rows the caller cannot read
set search_path = ''
as $$
  select p.id, p.username, p.display_name, p.bio, p.avatar_path, p.location, p.is_private, p.created_at,
         (select count(*)::integer from public.follows f where f.following_id = p.id),
         (select count(*)::integer from public.follows f where f.follower_id = p.id),
         (select count(*)::integer from public.posts x where x.author_id = p.id),
         (select count(*)::integer from public.activity_events e where e.user_id = p.id),
         public.relationship_with(p.id),
         public.can_view_author_content(p.id)
    from public.profiles p
   where p.id = p_user_id
     and (select auth.uid()) is not null
     -- hide anyone who blocked the caller
     and not exists (select 1 from public.blocks b where b.blocker_id = p.id and b.blocked_id = (select auth.uid()));
$$;

create or replace function public.get_my_follow_requests()
returns table (requester_id uuid, username text, display_name text, avatar_path text, requested_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select r.requester_id, p.username, p.display_name, p.avatar_path, r.created_at
    from public.follow_requests r
    join public.profiles p on p.id = r.requester_id
   where r.target_id = (select auth.uid())
     and not public.is_blocked_between(r.requester_id, r.target_id)
   order by r.created_at desc;
$$;

create or replace function public.get_my_blocked_users()
returns table (user_id uuid, username text, display_name text, avatar_path text, blocked_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select b.blocked_id, p.username, p.display_name, p.avatar_path, b.created_at
    from public.blocks b
    join public.profiles p on p.id = b.blocked_id
   where b.blocker_id = (select auth.uid())
   order by b.created_at desc;
$$;

-- "People to follow" (FR-12): accounts the caller does not follow / has not
-- requested, not blocked either way, ordered by follower count then newest.
create or replace function public.get_suggested_people(p_limit integer default 6)
returns table (id uuid, username text, display_name text, avatar_path text, is_private boolean, follower_count integer)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.username, p.display_name, p.avatar_path, p.is_private,
         (select count(*)::integer from public.follows f where f.following_id = p.id) as fc
    from public.profiles p
   where (select auth.uid()) is not null
     and p.id <> (select auth.uid())
     and not public.is_blocked_between((select auth.uid()), p.id)
     and not exists (select 1 from public.follows f where f.follower_id = (select auth.uid()) and f.following_id = p.id)
     and not exists (select 1 from public.follow_requests r where r.requester_id = (select auth.uid()) and r.target_id = p.id)
   order by fc desc, p.created_at desc
   limit least(greatest(coalesce(p_limit, 6), 1), 20);
$$;

-- ---------------------------------------------------------------- privileges
revoke execute on function public.relationship_with(uuid) from public, anon;
revoke execute on function public.follow_user(uuid) from public, anon;
revoke execute on function public.unfollow_user(uuid) from public, anon;
revoke execute on function public.accept_follow_request(uuid) from public, anon;
revoke execute on function public.reject_follow_request(uuid) from public, anon;
revoke execute on function public.block_user(uuid) from public, anon;
revoke execute on function public.unblock_user(uuid) from public, anon;
revoke execute on function public.get_profile_summary(uuid) from public, anon;
revoke execute on function public.get_my_follow_requests() from public, anon;
revoke execute on function public.get_my_blocked_users() from public, anon;
revoke execute on function public.get_suggested_people(integer) from public, anon;
revoke execute on function public.on_profile_privacy_changed() from public, anon, authenticated;

grant execute on function public.relationship_with(uuid) to authenticated;
grant execute on function public.follow_user(uuid) to authenticated;
grant execute on function public.unfollow_user(uuid) to authenticated;
grant execute on function public.accept_follow_request(uuid) to authenticated;
grant execute on function public.reject_follow_request(uuid) to authenticated;
grant execute on function public.block_user(uuid) to authenticated;
grant execute on function public.unblock_user(uuid) to authenticated;
grant execute on function public.get_profile_summary(uuid) to authenticated;
grant execute on function public.get_my_follow_requests() to authenticated;
grant execute on function public.get_my_blocked_users() to authenticated;
grant execute on function public.get_suggested_people(integer) to authenticated;
