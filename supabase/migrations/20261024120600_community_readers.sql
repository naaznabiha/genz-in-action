-- =============================================================================
-- Migration 20261024120600_community_readers
-- Phase 6 · Step 7 of 8
-- =============================================================================
-- Creates : one-request readers for every community screen:
--   get_communities(scope, query, cursor)       Explore → Communities (Discover / Mine)
--   get_my_community_invites()                  pending invites to me
--   get_community(community)                    detail header + my state + counts
--   get_community_members(community, cursor)    Members (owner, admins, members)
--   get_community_invites(community)            pending invites (owner/admin; inviter: own)
--   get_community_messages(community, cursor)   Discussion, newest first, 50 per page
--   get_pinned_messages(community)              pinned banner
--   get_starred_messages(community, cursor)     Starred (only yours)
--   get_community_feed(community, filter, cursor) Content: All / Posts / Photos / Documents / Text
-- Depends : 20261024120000…120500.
-- Safe to re-run : yes (CREATE OR REPLACE).
-- Destructive    : no.
--
-- Privacy: the list and detail readers are SECURITY DEFINER only to COUNT
-- members (non-members of a private community can't read member rows); they
-- return identity, counts and YOUR state, never member rows or content. Every
-- other reader is SECURITY INVOKER — the community RLS policies decide
-- (can_read_community + no blocked authors; stars: yours only).
-- Pagination: keyset everywhere (no OFFSET).
-- =============================================================================

create or replace function public.get_communities(
  p_scope          text        default 'discover',   -- discover | mine
  p_query          text        default null,
  p_before_created timestamptz default null,
  p_before_id      uuid        default null,
  p_limit          integer     default 20
)
returns table (
  id            uuid,
  name          text,
  description   text,
  image_path    text,
  is_private    boolean,
  owner_id      uuid,
  member_count  integer,
  my_role       text,       -- owner / admin / member, or null
  created_at    timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
set plan_cache_mode = force_custom_plan
as $$
#variable_conflict use_column
declare
  uid   uuid    := (select auth.uid());
  v_tsq tsquery := public.search_tsquery(p_query);
begin
  if uid is null then
    raise exception using errcode = '42501', message = 'Not signed in';
  end if;
  if p_query is not null and v_tsq is null then
    return;                                            -- nothing searchable typed
  end if;
  return query
  select c.id, c.name, c.description, c.image_path, c.is_private, c.owner_id,
         (select count(*)::integer from public.community_members x where x.community_id = c.id and x.status = 'active'),
         me.role,
         c.created_at
    from public.communities c
    left join public.community_members me on me.community_id = c.id and me.user_id = uid and me.status = 'active'
   where (p_scope <> 'mine' or me.user_id is not null)
     and (v_tsq is null or to_tsvector('simple', c.name || ' ' || c.description) @@ v_tsq)
     and (p_before_created is null
          or (c.created_at, c.id) < (p_before_created, coalesce(p_before_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
   order by c.created_at desc, c.id desc
   limit least(greatest(coalesce(p_limit, 20), 1), 50);
end;
$$;

create or replace function public.get_my_community_invites()
returns table (
  invite_id           uuid,
  community_id        uuid,
  community_name      text,
  community_image     text,
  is_private          boolean,
  inviter_id          uuid,
  inviter_username    text,
  inviter_display_name text,
  created_at          timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select i.id, c.id, c.name, c.image_path, c.is_private, p.id, p.username, p.display_name, i.created_at
    from public.community_invites i                    -- RLS: yours
    join public.communities c on c.id = i.community_id
    join public.profiles p on p.id = i.inviter_id      -- RLS: inviter not blocked either way
   where i.invitee_id = (select auth.uid()) and i.status = 'pending'
   order by i.created_at desc
   limit 50;
$$;

create or replace function public.get_community(p_community uuid)
returns table (
  id                  uuid,
  name                text,
  description         text,
  image_path          text,
  is_private          boolean,
  owner_id            uuid,
  owner_username      text,
  owner_display_name  text,
  created_at          timestamptz,
  member_count        integer,
  my_role             text,       -- active role or null
  my_status           text,       -- active / left / removed / null
  my_joined_at        timestamptz,
  can_read            boolean,    -- discussion, content and members open to you
  pending_invite_id   uuid,       -- an invite waiting for you
  invited_by_name     text,
  pinned_count        integer,    -- only when can_read
  messages_today      integer,    -- only when can_read
  content_count       integer     -- only when can_read
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  uid uuid := (select auth.uid());
  readable boolean := public.can_read_community(p_community);
begin
  if uid is null then
    raise exception using errcode = '42501', message = 'Not signed in';
  end if;
  return query
  select c.id, c.name, c.description, c.image_path, c.is_private, c.owner_id,
         case when public.can_see_profile(o.id) then o.username end,       -- hidden across a block
         case when public.can_see_profile(o.id) then o.display_name end,
         c.created_at,
         (select count(*)::integer from public.community_members x where x.community_id = c.id and x.status = 'active'),
         case when me.status = 'active' then me.role end,
         me.status,
         me.joined_at,
         readable,
         inv.id,
         case when ip.id is not null and public.can_see_profile(ip.id) then ip.display_name end,
         case when readable then (select count(*)::integer from public.community_message_pins pn where pn.community_id = c.id) end,
         case when readable then (select count(*)::integer from public.community_messages ms
                                   where ms.community_id = c.id and ms.created_at >= date_trunc('day', now())) end,
         case when readable then (select count(*)::integer from public.community_content cc where cc.community_id = c.id) end
    from public.communities c
    join public.profiles o on o.id = c.owner_id
    left join public.community_members me on me.community_id = c.id and me.user_id = uid
    left join public.community_invites inv on inv.community_id = c.id and inv.invitee_id = uid and inv.status = 'pending'
    left join public.profiles ip on ip.id = inv.inviter_id
   where c.id = p_community;
end;
$$;

create or replace function public.get_community_members(
  p_community  uuid,
  p_after_rank integer default null,
  p_after_name text    default null,
  p_limit      integer default 50
)
returns table (
  user_id      uuid,
  username     text,
  display_name text,
  avatar_path  text,
  role         text,
  role_rank    integer,       -- 0 owner, 1 admin, 2 member (cursor)
  joined_at    timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from (
    select p.id, p.username, p.display_name, p.avatar_path, m.role,
           case m.role when 'owner' then 0 when 'admin' then 1 else 2 end as rk,
           m.joined_at
      from public.community_members m                  -- RLS: readable community, no blocked people
      join public.profiles p on p.id = m.user_id
     where m.community_id = p_community and m.status = 'active'
  ) x
   where p_after_rank is null or (x.rk, x.username) > (p_after_rank, coalesce(p_after_name, ''))
   order by x.rk, x.username
   limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

create or replace function public.get_community_invites(p_community uuid)
returns table (
  invite_id            uuid,
  invitee_id           uuid,
  invitee_username     text,
  invitee_display_name text,
  invitee_avatar_path  text,
  inviter_id           uuid,
  inviter_display_name text,
  created_at           timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select i.id, e.id, e.username, e.display_name, e.avatar_path, r.id, r.display_name, i.created_at
    from public.community_invites i                    -- RLS: owner/admin, or the inviter
    join public.profiles e on e.id = i.invitee_id
    join public.profiles r on r.id = i.inviter_id
   where i.community_id = p_community and i.status = 'pending'
   order by i.created_at desc
   limit 100;
$$;

create or replace function public.get_community_messages(
  p_community      uuid,
  p_before_created timestamptz default null,
  p_before_id      uuid        default null,
  p_limit          integer     default 50
)
returns table (
  id                  uuid,
  author_id           uuid,
  author_username     text,
  author_display_name text,
  author_avatar_path  text,
  author_role         text,      -- current role, null if no longer a member
  body                text,
  attachment_path     text,
  attachment_kind     text,
  attachment_name     text,
  attachment_size     integer,
  attachment_width    integer,
  attachment_height   integer,
  created_at          timestamptz,
  pinned              boolean,
  starred_by_me       boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select m.id, a.id, a.username, a.display_name, a.avatar_path,
         am.role,
         m.body, m.attachment_path, m.attachment_kind, m.attachment_name, m.attachment_size,
         m.attachment_width, m.attachment_height, m.created_at,
         exists (select 1 from public.community_message_pins pn where pn.message_id = m.id),
         exists (select 1 from public.community_message_stars st where st.message_id = m.id and st.user_id = (select auth.uid()))
    from public.community_messages m                   -- RLS: readable community, no blocked authors
    join public.profiles a on a.id = m.author_id
    left join public.community_members am on am.community_id = m.community_id and am.user_id = m.author_id and am.status = 'active'
   where m.community_id = p_community
     and (p_before_created is null
          or (m.created_at, m.id) < (p_before_created, coalesce(p_before_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
   order by m.created_at desc, m.id desc
   limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

create or replace function public.get_pinned_messages(p_community uuid)
returns table (
  id                  uuid,
  author_id           uuid,
  author_display_name text,
  body                text,
  attachment_kind     text,
  attachment_name     text,
  created_at          timestamptz,
  pinned_at           timestamptz,
  pinned_by_name      text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select m.id, a.id, a.display_name, m.body, m.attachment_kind, m.attachment_name, m.created_at, pn.pinned_at, pb.display_name
    from public.community_message_pins pn              -- RLS: readable community
    join public.community_messages m on m.id = pn.message_id   -- RLS: no blocked authors
    join public.profiles a on a.id = m.author_id
    left join public.profiles pb on pb.id = pn.pinned_by
   where pn.community_id = p_community
   order by pn.pinned_at desc
   limit 50;
$$;

create or replace function public.get_starred_messages(
  p_community     uuid,
  p_before_starred timestamptz default null,
  p_before_id     uuid        default null,
  p_limit         integer     default 30
)
returns table (
  id                  uuid,
  author_id           uuid,
  author_username     text,
  author_display_name text,
  author_avatar_path  text,
  body                text,
  attachment_path     text,
  attachment_kind     text,
  attachment_name     text,
  attachment_size     integer,
  created_at          timestamptz,
  pinned              boolean,
  starred_at          timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select m.id, a.id, a.username, a.display_name, a.avatar_path, m.body,
         m.attachment_path, m.attachment_kind, m.attachment_name, m.attachment_size, m.created_at,
         exists (select 1 from public.community_message_pins pn where pn.message_id = m.id),
         st.created_at
    from public.community_message_stars st             -- RLS: yours only
    join public.community_messages m on m.id = st.message_id   -- RLS: still readable
    join public.profiles a on a.id = m.author_id
   where st.user_id = (select auth.uid())
     and m.community_id = p_community
     and (p_before_starred is null
          or (st.created_at, m.id) < (p_before_starred, coalesce(p_before_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
   order by st.created_at desc, m.id desc
   limit least(greatest(coalesce(p_limit, 30), 1), 50);
$$;

-- Content tab: lasting content items and posts shared to the community, one
-- timeline. Post rows carry the PostCard fields; content rows the attachment.
create or replace function public.get_community_feed(
  p_community      uuid,
  p_filter         text        default 'all',      -- all | posts | photos | documents | text
  p_before_created timestamptz default null,
  p_before_id      uuid        default null,
  p_limit          integer     default 20
)
returns table (
  item_type           text,      -- 'content' | 'post'
  id                  uuid,
  author_id           uuid,
  author_username     text,
  author_display_name text,
  author_avatar_path  text,
  author_is_member    boolean,   -- false: "no longer a member"
  title               text,
  body                text,
  created_at          timestamptz,
  updated_at          timestamptz,
  attachment_path     text,
  attachment_kind     text,
  attachment_name     text,
  attachment_size     integer,
  attachment_width    integer,
  attachment_height   integer,
  post_type           text,
  post_category       text,
  post_location       text,
  post_event_at       timestamptz,
  like_count          integer,
  comment_count       integer,
  liked_by_me         boolean,
  saved_by_me         boolean,
  media_path          text,
  media_width         integer,
  media_height        integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with items as (
    select 'content'::text as item_type, c.id, c.author_id, c.title, c.body, c.created_at, c.updated_at,
           c.attachment_path, c.attachment_kind, c.attachment_name, c.attachment_size, c.attachment_width, c.attachment_height,
           null::text as post_type, null::text as post_category, null::text as post_location, null::timestamptz as post_event_at,
           null::integer as like_count, null::integer as comment_count, null::boolean as liked_by_me, null::boolean as saved_by_me,
           null::text as media_path, null::integer as media_width, null::integer as media_height
      from public.community_content c                  -- RLS: readable community, no blocked authors
     where c.community_id = p_community
       and coalesce(p_filter, 'all') in ('all', 'photos', 'documents', 'text')
       and (coalesce(p_filter, 'all') = 'all'
            or (p_filter = 'photos' and c.attachment_kind = 'image')
            or (p_filter = 'documents' and c.attachment_kind = 'pdf')
            or (p_filter = 'text' and c.attachment_path is null))
    union all
    select 'post', p.id, p.author_id, p.title, p.body, p.created_at, p.updated_at,
           null, null, null, null, null, null,
           p.type, p.category, p.location, p.event_at,
           p.like_count, p.comment_count,
           exists (select 1 from public.post_likes l where l.post_id = p.id and l.user_id = (select auth.uid())),
           exists (select 1 from public.post_saves s where s.post_id = p.id and s.user_id = (select auth.uid())),
           pm.storage_path, pm.width, pm.height
      from public.posts p                              -- RLS: can_view_post
      left join public.post_media pm on pm.post_id = p.id and pm.position = 0
     where p.community_id = p_community
       and coalesce(p_filter, 'all') in ('all', 'posts')
  )
  select i.item_type, i.id, a.id, a.username, a.display_name, a.avatar_path,
         exists (select 1 from public.community_members m
                  where m.community_id = p_community and m.user_id = i.author_id and m.status = 'active'),
         i.title, i.body, i.created_at, i.updated_at,
         i.attachment_path, i.attachment_kind, i.attachment_name, i.attachment_size, i.attachment_width, i.attachment_height,
         i.post_type, i.post_category, i.post_location, i.post_event_at,
         i.like_count, i.comment_count, i.liked_by_me, i.saved_by_me,
         i.media_path, i.media_width, i.media_height
    from items i
    join public.profiles a on a.id = i.author_id
   where p_before_created is null
      or (i.created_at, i.id) < (p_before_created, coalesce(p_before_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))
   order by i.created_at desc, i.id desc
   limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.get_communities(text,text,timestamptz,uuid,integer)', 'public.get_my_community_invites()',
    'public.get_community(uuid)', 'public.get_community_members(uuid,integer,text,integer)',
    'public.get_community_invites(uuid)', 'public.get_community_messages(uuid,timestamptz,uuid,integer)',
    'public.get_pinned_messages(uuid)', 'public.get_starred_messages(uuid,timestamptz,uuid,integer)',
    'public.get_community_feed(uuid,text,timestamptz,uuid,integer)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
