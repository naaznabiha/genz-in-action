-- =============================================================================
-- Migration 20261024120300_community_notifications
-- Phase 6 · Step 4 of 8
-- =============================================================================
-- Changes : • notifications accept community types and targets
--           • create_notification(...): new content respects Activity Updates
--           • public.get_notification_list(...) — the Phase 5 list plus the
--             community, the invite's status and the content title. A NEW
--             function, so Phase 5's get_notifications keeps its exact contract
--             (and its file stays safe to re-run); the app now calls this one.
-- Creates : • new-content fan-out trigger, cleanup triggers
-- Depends : Phase 5 notification RPCs, 20261024120000_communities_tables.
-- Safe to re-run : yes.
-- Destructive    : no data deleted (constraints widened, function replaced).
-- Spec    : §11 "Community invitations and their outcomes, and relevant
--           community activity", decision D52.
--
-- New types (target in brackets):
--   community_invite           "X invited you to C"          [community_invite]
--   community_invite_accepted  "X accepted your invite to C" [community]
--   community_invite_declined  "X declined your invite to C" [community]
--   community_role             "X made you an admin of C"    [community]
--   community_owner            "X made you the owner of C"   [community]
--   community_content          "X added 'T' to C"            [community_content]
--                              (to every active member except the author;
--                              respects Activity Updates)
-- Chat messages never notify: the discussion updates live while open (D52).
-- Same rules as before: never yourself, never across a block, created only by
-- trusted database logic.
-- =============================================================================

alter table public.notifications drop constraint if exists notifications_type_valid;
alter table public.notifications add constraint notifications_type_valid
  check (type in ('like', 'comment', 'follow', 'follow_request', 'follow_accepted',
                  'community_invite', 'community_invite_accepted', 'community_invite_declined',
                  'community_role', 'community_owner', 'community_content'));
alter table public.notifications drop constraint if exists notifications_target_type_valid;
alter table public.notifications add constraint notifications_target_type_valid
  check (target_type in ('post', 'comment', 'profile', 'community', 'community_invite', 'community_content'));

create or replace function public.create_notification(
  p_recipient   uuid,
  p_actor       uuid,
  p_type        text,
  p_target_type text,
  p_target_id   uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_recipient is null or p_actor is null or p_recipient = p_actor then
    return;
  end if;
  if public.is_blocked_between(p_recipient, p_actor) then
    return;
  end if;
  if p_type in ('like', 'comment', 'follow', 'community_content')
     and exists (select 1 from public.user_settings s
                  where s.user_id = p_recipient and not s.notify_activity) then
    return;
  end if;

  insert into public.notifications (recipient_id, actor_id, type, target_type, target_id)
  values (p_recipient, p_actor, p_type, p_target_type, p_target_id)
  on conflict (recipient_id, actor_id, type, target_id)
    where type in ('like', 'follow', 'follow_request', 'follow_accepted')
    do update set created_at = now(), read_at = null
     where public.notifications.type = 'follow_accepted';   -- likes / follows stay de-duplicated (Phase 5)
end;
$$;
revoke execute on function public.create_notification(uuid, uuid, text, text, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------- triggers
create or replace function public.on_community_content_created()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  m record;
begin
  for m in select cm.user_id from public.community_members cm
            where cm.community_id = new.community_id and cm.status = 'active' and cm.user_id <> new.author_id loop
    perform public.create_notification(m.user_id, new.author_id, 'community_content', 'community_content', new.id);
  end loop;
  return null;
end;
$$;

create or replace function public.on_community_content_deleted()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.notifications where target_type = 'community_content' and target_id = old.id;
  return null;
end;
$$;

create or replace function public.on_community_invite_deleted()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.notifications where target_type = 'community_invite' and target_id = old.id;
  return null;
end;
$$;

create or replace function public.on_community_deleted()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.notifications where target_type = 'community' and target_id = old.id;
  return null;
end;
$$;

revoke execute on function public.on_community_content_created() from public, anon, authenticated;
revoke execute on function public.on_community_content_deleted() from public, anon, authenticated;
revoke execute on function public.on_community_invite_deleted() from public, anon, authenticated;
revoke execute on function public.on_community_deleted() from public, anon, authenticated;

create or replace trigger community_content_after_insert_notify
  after insert on public.community_content for each row execute function public.on_community_content_created();
create or replace trigger community_content_after_delete_notify
  after delete on public.community_content for each row execute function public.on_community_content_deleted();
create or replace trigger community_invites_after_delete_notify
  after delete on public.community_invites for each row execute function public.on_community_invite_deleted();
create or replace trigger communities_after_delete_notify
  after delete on public.communities for each row execute function public.on_community_deleted();

-- ---------------------------------------------------------------- the list (Phase 5 columns + community details)
create or replace function public.get_notification_list(
  p_before_at  timestamptz default null,
  p_before_key text        default null,
  p_limit      integer     default 30
)
returns table (
  key                  text,
  type                 text,
  target_type          text,
  target_id            uuid,
  post_id              uuid,
  post_title           text,
  comment_excerpt      text,
  actor_id             uuid,
  actor_username       text,
  actor_display_name   text,
  actor_avatar_path    text,
  actor_count          integer,
  created_at           timestamptz,
  unread               boolean,
  community_id         uuid,     -- community notifications: which community
  community_name       text,
  community_image_path text,
  invite_status        text,     -- community_invite: pending / accepted / declined
  content_title        text      -- community_content: the item's title
)
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (                                      -- notifications_select_own, applied explicitly
    select n.id, n.actor_id, n.created_at, n.read_at,
           case when n.type = 'like' then 'like:' || n.target_id::text else n.id::text end as k
      from public.notifications n
      join public.profiles who on who.id = n.actor_id
                              and public.can_see_profile(who.id)   -- no blocked actors (either way)
     where n.recipient_id = (select auth.uid())
  ),
  items as (
    select m.k,
           max(m.created_at)                                  as created_at,
           bool_or(m.read_at is null)                         as unread,
           count(distinct m.actor_id)::integer                as actor_count,
           (array_agg(m.id order by m.created_at desc, m.id desc))[1] as latest_id
      from mine m
     group by m.k
  )
  select i.k, n.type, n.target_type, n.target_id,
         coalesce(case when n.target_type = 'post' then n.target_id end, c.post_id) as post_id,
         p.title,
         left(c.body, 120),
         a.id, a.username, a.display_name, a.avatar_path,
         i.actor_count, i.created_at, i.unread,
         cm.id, cm.name, cm.image_path,
         ci.status,
         cc.title
    from items i
    join public.notifications n on n.id = i.latest_id
    join public.profiles a on a.id = n.actor_id
    left join public.comments c on n.target_type = 'comment' and c.id = n.target_id
    left join public.posts p on p.id = coalesce(case when n.target_type = 'post' then n.target_id end, c.post_id)
    left join public.community_invites ci on n.target_type = 'community_invite' and ci.id = n.target_id
    left join public.community_content cc on n.target_type = 'community_content' and cc.id = n.target_id
    left join public.communities cm on cm.id = case n.target_type
                                                when 'community' then n.target_id
                                                when 'community_invite' then ci.community_id
                                                when 'community_content' then cc.community_id
                                              end
   where p_before_at is null
      or (i.created_at, i.k) < (p_before_at, coalesce(p_before_key, ''))
   order by i.created_at desc, i.k desc
   limit least(greatest(coalesce(p_limit, 30), 1), 50);
$$;

comment on function public.get_notification_list(timestamptz, text, integer) is
  'GenZ in Action: the caller''s notifications, newest first, likes on the same post grouped (D43), with community / invite / content details (Phase 6); keyset cursor (created_at, key).';
revoke execute on function public.get_notification_list(timestamptz, text, integer) from public, anon;
grant execute on function public.get_notification_list(timestamptz, text, integer) to authenticated;
