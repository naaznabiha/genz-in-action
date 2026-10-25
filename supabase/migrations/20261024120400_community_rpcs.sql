-- =============================================================================
-- Migration 20261024120400_community_rpcs
-- Phase 6 · Step 5 of 8
-- =============================================================================
-- Creates : the ONLY ways to change communities, membership and invites:
--   create_community, update_community, join_community, leave_community,
--   delete_community (sole owner only), invite_to_community,
--   respond_to_invite, cancel_invite, set_member_role, remove_member,
--   transfer_ownership.
--   (Messages, pins, stars and content are written directly; their RLS
--   policies decide — previous migrations.)
-- Depends : 20261024120000…120300.
-- Safe to re-run : yes (CREATE OR REPLACE).
-- Destructive    : no.
-- Spec    : §11 community rules; decisions D47–D49, D53.
--
-- Rules:
--   • creating sets you as the owner (active).
--   • public: join instantly. private: invite only (link invites and join
--     requests deferred). Someone REMOVED from a public community can't rejoin
--     by themselves; an admin can invite them back.
--   • invites: owner/admin, existing users only, never across a block (the
--     invitee just appears "not found"), one pending invite per person.
--   • roles (D48): the owner appoints/demotes admins and transfers ownership;
--     owner and admins invite and remove members; an admin can't remove the
--     owner or another admin.
--   • the owner can't leave until ownership is transferred; an owner who is
--     the ONLY active member may delete the community instead (D53).
-- Errors: PT404 (HTTP 404) = not found / not allowed to know; 42501 = not
-- allowed; P0001 with a GENZ_* message = a rule the app explains.
-- =============================================================================

create or replace function public.create_community(
  p_name        text,
  p_description text    default '',
  p_image_path  text    default null,
  p_is_private  boolean default false
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  cid uuid;
begin
  if uid is null then
    raise exception using errcode = '42501', message = 'Not signed in';
  end if;
  insert into public.communities (owner_id, name, description, image_path, is_private)
  values (uid, btrim(coalesce(p_name, '')), btrim(coalesce(p_description, '')), p_image_path, coalesce(p_is_private, false))
  returning id into cid;
  insert into public.community_members (community_id, user_id, role, status) values (cid, uid, 'owner', 'active');
  return cid;
end;
$$;

create or replace function public.update_community(
  p_community   uuid,
  p_name        text,
  p_description text,
  p_image_path  text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if coalesce(public.community_role(p_community), '') not in ('owner', 'admin') then
    raise exception using errcode = '42501', message = 'Only the owner and admins can edit the community';
  end if;
  update public.communities
     set name = btrim(coalesce(p_name, name)),
         description = btrim(coalesce(p_description, description)),
         image_path = p_image_path,
         updated_at = now()
   where id = p_community;
end;
$$;

create or replace function public.join_community(p_community uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  c record;
  m record;
begin
  if uid is null then
    raise exception using errcode = '42501', message = 'Not signed in';
  end if;
  select * into c from public.communities where id = p_community;
  if not found then
    raise exception using errcode = 'PT404', message = 'Community not found';
  end if;
  select * into m from public.community_members where community_id = p_community and user_id = uid;
  if found and m.status = 'active' then
    return m.role;
  end if;
  if c.is_private then
    raise exception using errcode = 'P0001', message = 'GENZ_COMMUNITY_PRIVATE: this community is invite-only';
  end if;
  if found and m.status = 'removed' then
    raise exception using errcode = 'P0001', message = 'GENZ_COMMUNITY_REMOVED: you were removed from this community; an admin can invite you back';
  end if;
  insert into public.community_members (community_id, user_id, role, status)
  values (p_community, uid, 'member', 'active')
  on conflict (community_id, user_id) do update set role = 'member', status = 'active', joined_at = now(), updated_at = now();
  -- a pending invite to a public community is fulfilled by joining
  update public.community_invites set status = 'accepted', responded_at = now()
   where community_id = p_community and invitee_id = uid and status = 'pending';
  return 'member';
end;
$$;

create or replace function public.leave_community(p_community uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  r text := public.community_role(p_community);
begin
  if r is null then
    raise exception using errcode = 'PT404', message = 'You are not a member of this community';
  end if;
  if r = 'owner' then
    raise exception using errcode = 'P0001', message = 'GENZ_OWNER_MUST_TRANSFER: choose a new owner before you leave';
  end if;
  update public.community_members set status = 'left', role = 'member', updated_at = now()
   where community_id = p_community and user_id = (select auth.uid());
end;
$$;

create or replace function public.delete_community(p_community uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if public.community_role(p_community) is distinct from 'owner' then
    raise exception using errcode = '42501', message = 'Only the owner can delete the community';
  end if;
  if (select count(*) from public.community_members
       where community_id = p_community and status = 'active') > 1 then
    raise exception using errcode = 'P0001', message = 'GENZ_COMMUNITY_HAS_MEMBERS: transfer ownership instead; only a community with no other members can be deleted';
  end if;
  delete from public.communities where id = p_community;   -- cascades messages, pins, stars, content, invites, community posts
end;
$$;

create or replace function public.invite_to_community(p_community uuid, p_user uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  existing uuid;
  iid uuid;
begin
  if coalesce(public.community_role(p_community), '') not in ('owner', 'admin') then
    raise exception using errcode = '42501', message = 'Only the owner and admins can invite people';
  end if;
  if p_user is null or p_user = uid
     or not exists (select 1 from public.profiles where id = p_user)
     or public.is_blocked_between(uid, p_user) then
    raise exception using errcode = 'PT404', message = 'User not found';
  end if;
  if exists (select 1 from public.community_members
              where community_id = p_community and user_id = p_user and status = 'active') then
    raise exception using errcode = 'P0001', message = 'GENZ_ALREADY_MEMBER: they are already a member';
  end if;
  select id into existing from public.community_invites
   where community_id = p_community and invitee_id = p_user and status = 'pending';
  if existing is not null then
    return existing;
  end if;
  insert into public.community_invites (community_id, invitee_id, inviter_id)
  values (p_community, p_user, uid) returning id into iid;
  perform public.create_notification(p_user, uid, 'community_invite', 'community_invite', iid);
  return iid;
end;
$$;

create or replace function public.respond_to_invite(p_invite uuid, p_accept boolean)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  inv record;
begin
  select * into inv from public.community_invites where id = p_invite and invitee_id = uid and status = 'pending';
  if not found then
    raise exception using errcode = 'PT404', message = 'Invite not found';
  end if;
  update public.community_invites
     set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now()
   where id = p_invite;
  update public.notifications set read_at = coalesce(read_at, now())
   where recipient_id = uid and target_type = 'community_invite' and target_id = p_invite;
  if p_accept then
    insert into public.community_members (community_id, user_id, role, status)
    values (inv.community_id, uid, 'member', 'active')
    on conflict (community_id, user_id) do update
      set role = case when public.community_members.status = 'active' then public.community_members.role else 'member' end,
          status = 'active', joined_at = now(), updated_at = now();
    perform public.create_notification(inv.inviter_id, uid, 'community_invite_accepted', 'community', inv.community_id);
    return 'accepted';
  end if;
  perform public.create_notification(inv.inviter_id, uid, 'community_invite_declined', 'community', inv.community_id);
  return 'declined';
end;
$$;

create or replace function public.cancel_invite(p_invite uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  inv record;
begin
  select * into inv from public.community_invites where id = p_invite and status = 'pending';
  if not found
     or (inv.inviter_id <> (select auth.uid())
         and coalesce(public.community_role(inv.community_id), '') not in ('owner', 'admin')) then
    raise exception using errcode = 'PT404', message = 'Invite not found';
  end if;
  update public.community_invites set status = 'cancelled', responded_at = now() where id = p_invite;
  delete from public.notifications where target_type = 'community_invite' and target_id = p_invite;
end;
$$;

create or replace function public.set_member_role(p_community uuid, p_user uuid, p_role text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  cur_role text;
begin
  if public.community_role(p_community) is distinct from 'owner' then
    raise exception using errcode = '42501', message = 'Only the owner can change roles';
  end if;
  if p_role not in ('admin', 'member') then
    raise exception using errcode = '22023', message = 'role must be admin or member';
  end if;
  select role into cur_role from public.community_members
   where community_id = p_community and user_id = p_user and status = 'active';
  if cur_role is null or cur_role = 'owner' then
    raise exception using errcode = 'PT404', message = 'Member not found';
  end if;
  update public.community_members set role = p_role, updated_at = now()
   where community_id = p_community and user_id = p_user;
  if p_role = 'admin' and cur_role <> 'admin' then
    perform public.create_notification(p_user, (select auth.uid()), 'community_role', 'community', p_community);
  end if;
end;
$$;

create or replace function public.remove_member(p_community uuid, p_user uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me text := public.community_role(p_community);
  them text;
begin
  if coalesce(me, '') not in ('owner', 'admin') then
    raise exception using errcode = '42501', message = 'Only the owner and admins can remove members';
  end if;
  if p_user = (select auth.uid()) then
    raise exception using errcode = 'P0001', message = 'GENZ_USE_LEAVE: use Leave community instead';
  end if;
  select role into them from public.community_members
   where community_id = p_community and user_id = p_user and status = 'active';
  if them is null then
    raise exception using errcode = 'PT404', message = 'Member not found';
  end if;
  if them = 'owner' or (them = 'admin' and me <> 'owner') then
    raise exception using errcode = '42501', message = 'Only the owner can remove an admin, and nobody can remove the owner';
  end if;
  update public.community_members set status = 'removed', role = 'member', updated_at = now()
   where community_id = p_community and user_id = p_user;
end;
$$;

create or replace function public.transfer_ownership(p_community uuid, p_user uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if public.community_role(p_community) is distinct from 'owner' then
    raise exception using errcode = '42501', message = 'Only the owner can transfer ownership';
  end if;
  if p_user = uid or not exists (select 1 from public.community_members
                                   where community_id = p_community and user_id = p_user and status = 'active') then
    raise exception using errcode = 'PT404', message = 'Member not found';
  end if;
  update public.community_members set role = 'admin', updated_at = now()
   where community_id = p_community and user_id = uid;
  update public.community_members set role = 'owner', updated_at = now()
   where community_id = p_community and user_id = p_user;
  update public.communities set owner_id = p_user, updated_at = now() where id = p_community;
  perform public.create_notification(p_user, uid, 'community_owner', 'community', p_community);
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.create_community(text,text,text,boolean)', 'public.update_community(uuid,text,text,text)',
    'public.join_community(uuid)', 'public.leave_community(uuid)', 'public.delete_community(uuid)',
    'public.invite_to_community(uuid,uuid)', 'public.respond_to_invite(uuid,boolean)', 'public.cancel_invite(uuid)',
    'public.set_member_role(uuid,uuid,text)', 'public.remove_member(uuid,uuid)', 'public.transfer_ownership(uuid,uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
