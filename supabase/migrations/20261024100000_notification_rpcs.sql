-- =============================================================================
-- Migration 20261024100000_notification_rpcs
-- Phase 5 · Step 1 of 4
-- =============================================================================
-- Creates : • index for the unread count
--           • public.get_notifications(cursor, limit) — the Notifications list
--           • public.get_unread_notification_count() — the bell badge
--           • public.mark_notification_read(key) — tapping one item
--           • public.mark_all_notifications_read() — "Mark all read"
-- Depends : Phase 3 notifications (+ its triggers), posts, comments, profiles.
-- Safe to re-run : yes (IF NOT EXISTS / CREATE OR REPLACE).
-- Destructive    : no.
-- Spec    : FR-15, §11 MVP in-app notification types, §12 "Notification rows
--           readable/updateable only by their recipient, with creation handled
--           through trusted database logic".
--
-- Notifications are still created ONLY by the Phase 3 triggers (never by the
-- app): no self-notifications, nothing across a block, like/comment/follow
-- respect Activity Updates. What you see is exactly the Phase 3 read policy
-- (notifications_select_own): only rows where you are the recipient, and
-- nothing from someone you blocked or who blocked you (the shared helper
-- can_see_profile on the actor). The two readers apply that rule explicitly
-- as SECURITY DEFINER (decision D41): under RLS the block check ran on every
-- row (215 ms for 3,300 notifications); here it runs once per person on the
-- actor join. The two writers stay SECURITY INVOKER (RLS update policy).
--
-- Grouping (decision D43, your answer): all likes on the same post are ONE
-- item — "Maya and 3 others liked your post" — showing the most recent liker.
-- The item is unread while any like in it is unread, its time is the newest
-- like, and opening it marks all those likes read. Every other notification is
-- its own item. Item key: 'like:<post id>' for a like group, else the
-- notification id. The unread count counts items the same way, so the badge
-- always equals the number of highlighted rows.
--
-- Pagination: keyset on (created_at, key), newest first — no OFFSET.
-- =============================================================================

create index if not exists notifications_unread_idx
  on public.notifications (recipient_id)
  where read_at is null;

create or replace function public.get_notifications(
  p_before_at  timestamptz default null,
  p_before_key text        default null,
  p_limit      integer     default 30
)
returns table (
  key                 text,
  type                text,
  target_type         text,
  target_id           uuid,
  post_id             uuid,     -- the post to open (like / comment), else null
  post_title          text,
  comment_excerpt     text,
  actor_id            uuid,     -- most recent actor of the item
  actor_username      text,
  actor_display_name  text,
  actor_avatar_path   text,
  actor_count         integer,  -- distinct people in the item (likes group), else 1
  created_at          timestamptz,
  unread              boolean
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
         i.actor_count, i.created_at, i.unread
    from items i
    join public.notifications n on n.id = i.latest_id
    join public.profiles a on a.id = n.actor_id
    left join public.comments c on n.target_type = 'comment' and c.id = n.target_id
    left join public.posts p on p.id = coalesce(case when n.target_type = 'post' then n.target_id end, c.post_id)
   where p_before_at is null
      or (i.created_at, i.k) < (p_before_at, coalesce(p_before_key, ''))
   order by i.created_at desc, i.k desc
   limit least(greatest(coalesce(p_limit, 30), 1), 50);
$$;

comment on function public.get_notifications(timestamptz, text, integer) is
  'GenZ in Action: the caller''s notifications, newest first, likes on the same post grouped into one item (D43); keyset cursor (created_at, key).';

create or replace function public.get_unread_notification_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(distinct case when n.type = 'like' then 'like:' || n.target_id::text else n.id::text end)::integer
    from public.notifications n
    join public.profiles who on who.id = n.actor_id
                            and public.can_see_profile(who.id)     -- same rule as the list
   where n.recipient_id = (select auth.uid())
     and n.read_at is null;
$$;

comment on function public.get_unread_notification_count() is
  'GenZ in Action: number of unread notification items for the bell badge (a like group counts once, D43).';

-- Marks one item read (a like group: all its likes). Returns rows changed.
-- Only the caller's own rows can change (RLS update policy + recipient filter).
create or replace function public.mark_notification_read(p_key text)
returns integer
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  target uuid;
  n integer := 0;
begin
  if uid is null then
    raise exception using errcode = '42501', message = 'Not signed in';
  end if;
  begin
    if p_key like 'like:%' then
      target := substr(p_key, 6)::uuid;
      update public.notifications set read_at = now()
       where recipient_id = uid and type = 'like' and target_id = target and read_at is null;
    else
      target := p_key::uuid;
      update public.notifications set read_at = now()
       where recipient_id = uid and id = target and read_at is null;
    end if;
    get diagnostics n = row_count;
  exception when invalid_text_representation then
    return 0;                                         -- malformed key: nothing to mark
  end;
  return n;
end;
$$;

create or replace function public.mark_all_notifications_read()
returns integer
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  n integer;
begin
  if uid is null then
    raise exception using errcode = '42501', message = 'Not signed in';
  end if;
  update public.notifications set read_at = now()
   where recipient_id = uid and read_at is null;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.get_notifications(timestamptz, text, integer) from public, anon;
revoke execute on function public.get_unread_notification_count() from public, anon;
revoke execute on function public.mark_notification_read(text) from public, anon;
revoke execute on function public.mark_all_notifications_read() from public, anon;
grant execute on function public.get_notifications(timestamptz, text, integer) to authenticated;
grant execute on function public.get_unread_notification_count() to authenticated;
grant execute on function public.mark_notification_read(text) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;
