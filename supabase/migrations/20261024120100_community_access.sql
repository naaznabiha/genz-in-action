-- =============================================================================
-- Migration 20261024120100_community_access
-- Phase 6 · Step 2 of 8
-- =============================================================================
-- Creates : shared community helpers
--             • public.community_role(community)      — caller's ACTIVE role or null
--             • public.can_read_community(community)  — public, or caller is an active member
--             • public.can_view_post(author, community) — THE post visibility rule
--           RLS policies + grants for every community table.
-- Changes : the posts read/insert policies and every policy that reads posts
--           (photos, hashtags, comments, likes, saves) now use can_view_post,
--           so a post shared to a community follows the community's rules.
-- Depends : 20261024120000_communities_tables, Phase 3 visibility helpers.
-- Safe to re-run : yes (CREATE OR REPLACE, policies recreated by name).
-- Destructive    : no data touched. Re-creates the post-related SELECT/INSERT
--           policies by the SAME names as Phase 3. If you re-run a Phase 3
--           file later, re-run this file after it (94/98 checks catch it).
-- Spec    : §11 communities, §12 "non-members can never read a private
--           community's discussion or content", decisions D47–D52.
--
-- Rules (D49, D51):
--   read a community's discussion / content / member list
--       = the community is public, or you are an ACTIVE member;
--     and nothing written by someone you blocked or who blocked you.
--   write (message, content, community post) = you are an ACTIVE member.
--   pin / unpin, remove others' messages or content = owner or admin.
--   stars = only ever visible to the person who starred.
--   post visibility (can_view_post):
--       Everyone post   → can_view_author_content(author) (Phase 3, unchanged)
--       community post  → you wrote it, or (not blocked either way AND you can
--                         read that community). Account privacy does not hide
--                         a community post from that community's readers.
-- =============================================================================

create or replace function public.community_role(p_community uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role from public.community_members m
   where m.community_id = p_community
     and m.user_id = (select auth.uid())
     and m.status = 'active';
$$;

create or replace function public.can_read_community(p_community uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
     and exists (
       select 1 from public.communities c
        where c.id = p_community
          and (not c.is_private
               or exists (select 1 from public.community_members m
                           where m.community_id = c.id and m.user_id = (select auth.uid()) and m.status = 'active'))
     );
$$;

create or replace function public.can_view_post(p_author uuid, p_community uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
           when p_community is null then public.can_view_author_content(p_author)
           else (select auth.uid()) is not null
                and (p_author = (select auth.uid())
                     or (not public.is_blocked_between((select auth.uid()), p_author)
                         and public.can_read_community(p_community)))
         end;
$$;

comment on function public.community_role(uuid) is 'GenZ in Action: the caller''s active role in a community (owner/admin/member) or null.';
comment on function public.can_read_community(uuid) is 'GenZ in Action: can the caller read this community''s discussion, content and members (public, or active member)?';
comment on function public.can_view_post(uuid, uuid) is 'GenZ in Action: post visibility — Everyone posts follow can_view_author_content; community posts follow the community (D51).';

revoke execute on function public.community_role(uuid) from public, anon;
revoke execute on function public.can_read_community(uuid) from public, anon;
revoke execute on function public.can_view_post(uuid, uuid) from public, anon;
grant execute on function public.community_role(uuid) to authenticated;
grant execute on function public.can_read_community(uuid) to authenticated;
grant execute on function public.can_view_post(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------- triggers
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;

create or replace trigger community_content_touch
  before update on public.community_content
  for each row execute function public.touch_updated_at();

-- A pin always belongs to its message's community (set here, not by the client).
create or replace function public.community_pin_fill()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select m.community_id into new.community_id from public.community_messages m where m.id = new.message_id;
  if new.community_id is null then
    raise exception using errcode = '23503', message = 'GENZ_MESSAGE_NOT_FOUND: that message does not exist';
  end if;
  new.pinned_at := now();
  return new;
end;
$$;
revoke execute on function public.community_pin_fill() from public, anon, authenticated;
create or replace trigger community_message_pins_fill
  before insert on public.community_message_pins
  for each row execute function public.community_pin_fill();

-- ---------------------------------------------------------------- grants
revoke all on table public.communities, public.community_members, public.community_invites,
  public.community_messages, public.community_message_pins, public.community_message_stars,
  public.community_content from anon, authenticated;

grant select on table public.communities, public.community_members, public.community_invites to authenticated;
-- communities / members / invites: written only by RPCs (next migrations).

grant select, delete on table public.community_messages to authenticated;
grant insert (community_id, author_id, body, attachment_path, attachment_kind, attachment_name, attachment_width, attachment_height)
  on table public.community_messages to authenticated;

alter table public.community_message_pins alter column pinned_by set default auth.uid();
grant select, delete on table public.community_message_pins to authenticated;
grant insert (message_id) on table public.community_message_pins to authenticated;

alter table public.community_message_stars alter column user_id set default auth.uid();
grant select, delete on table public.community_message_stars to authenticated;
grant insert (message_id) on table public.community_message_stars to authenticated;

grant select, delete on table public.community_content to authenticated;
grant insert (community_id, author_id, title, body, attachment_path, attachment_kind, attachment_name, attachment_width, attachment_height)
  on table public.community_content to authenticated;
grant update (title, body) on table public.community_content to authenticated;

alter table public.communities enable row level security;
alter table public.community_members enable row level security;
alter table public.community_invites enable row level security;
alter table public.community_messages enable row level security;
alter table public.community_message_pins enable row level security;
alter table public.community_message_stars enable row level security;
alter table public.community_content enable row level security;

-- ---------------------------------------------------------------- policies
drop policy if exists "communities_select_all" on public.communities;
create policy "communities_select_all"
  on public.communities for select to authenticated
  using (true);   -- identity (name, description, image) is public, D47

drop policy if exists "community_members_select" on public.community_members;
create policy "community_members_select"
  on public.community_members for select to authenticated
  using (
    user_id = (select auth.uid())
    or (public.can_read_community(community_id) and public.can_see_profile(user_id))
  );

drop policy if exists "community_invites_select" on public.community_invites;
create policy "community_invites_select"
  on public.community_invites for select to authenticated
  using (
    invitee_id = (select auth.uid())
    or inviter_id = (select auth.uid())
    or public.community_role(community_id) in ('owner', 'admin')
  );

drop policy if exists "community_messages_select" on public.community_messages;
create policy "community_messages_select"
  on public.community_messages for select to authenticated
  using (public.can_read_community(community_id) and public.can_see_profile(author_id));

drop policy if exists "community_messages_insert" on public.community_messages;
create policy "community_messages_insert"
  on public.community_messages for insert to authenticated
  with check (author_id = (select auth.uid()) and public.community_role(community_id) is not null);

drop policy if exists "community_messages_delete" on public.community_messages;
create policy "community_messages_delete"
  on public.community_messages for delete to authenticated
  using (author_id = (select auth.uid()) or public.community_role(community_id) in ('owner', 'admin'));

drop policy if exists "community_message_pins_select" on public.community_message_pins;
create policy "community_message_pins_select"
  on public.community_message_pins for select to authenticated
  using (public.can_read_community(community_id));

drop policy if exists "community_message_pins_insert" on public.community_message_pins;
create policy "community_message_pins_insert"
  on public.community_message_pins for insert to authenticated
  with check (pinned_by = (select auth.uid()) and public.community_role(community_id) in ('owner', 'admin'));

drop policy if exists "community_message_pins_delete" on public.community_message_pins;
create policy "community_message_pins_delete"
  on public.community_message_pins for delete to authenticated
  using (public.community_role(community_id) in ('owner', 'admin'));

drop policy if exists "community_message_stars_select" on public.community_message_stars;
create policy "community_message_stars_select"
  on public.community_message_stars for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "community_message_stars_insert" on public.community_message_stars;
create policy "community_message_stars_insert"
  on public.community_message_stars for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.community_messages m where m.id = message_id)   -- RLS: a message you can read
  );

drop policy if exists "community_message_stars_delete" on public.community_message_stars;
create policy "community_message_stars_delete"
  on public.community_message_stars for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "community_content_select" on public.community_content;
create policy "community_content_select"
  on public.community_content for select to authenticated
  using (public.can_read_community(community_id) and public.can_see_profile(author_id));

drop policy if exists "community_content_insert" on public.community_content;
create policy "community_content_insert"
  on public.community_content for insert to authenticated
  with check (author_id = (select auth.uid()) and public.community_role(community_id) is not null);

drop policy if exists "community_content_update" on public.community_content;
create policy "community_content_update"
  on public.community_content for update to authenticated
  using (author_id = (select auth.uid()) and public.community_role(community_id) is not null)
  with check (author_id = (select auth.uid()));

drop policy if exists "community_content_delete" on public.community_content;
create policy "community_content_delete"
  on public.community_content for delete to authenticated
  using (author_id = (select auth.uid()) or public.community_role(community_id) in ('owner', 'admin'));

-- ---------------------------------------------------------------- posts and everything that reads them
grant insert (community_id) on table public.posts to authenticated;

drop policy if exists "posts_select_visible" on public.posts;
create policy "posts_select_visible"
  on public.posts for select to authenticated
  using (public.can_view_post(author_id, community_id));

drop policy if exists "posts_insert_own" on public.posts;
create policy "posts_insert_own"
  on public.posts for insert to authenticated
  with check (
    (select auth.uid()) = author_id
    and (community_id is null or public.community_role(community_id) is not null)   -- only to a community you're in
  );

drop policy if exists "post_media_select_visible" on public.post_media;
create policy "post_media_select_visible"
  on public.post_media for select to authenticated
  using (exists (select 1 from public.posts p
                  where p.id = post_id and public.can_view_post(p.author_id, p.community_id)));

drop policy if exists "post_hashtags_select_visible" on public.post_hashtags;
create policy "post_hashtags_select_visible"
  on public.post_hashtags for select to authenticated
  using (exists (select 1 from public.posts p
                  where p.id = post_id and public.can_view_post(p.author_id, p.community_id)));

drop policy if exists "post_likes_insert_own_visible" on public.post_likes;
create policy "post_likes_insert_own_visible"
  on public.post_likes for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.posts p
                 where p.id = post_id and public.can_view_post(p.author_id, p.community_id))
  );

drop policy if exists "post_saves_insert_own_visible" on public.post_saves;
create policy "post_saves_insert_own_visible"
  on public.post_saves for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.posts p
                 where p.id = post_id and public.can_view_post(p.author_id, p.community_id))
  );

drop policy if exists "comments_select_visible" on public.comments;
create policy "comments_select_visible"
  on public.comments for select to authenticated
  using (
    public.can_see_profile(author_id)
    and exists (select 1 from public.posts p
                 where p.id = post_id and public.can_view_post(p.author_id, p.community_id))
  );

drop policy if exists "comments_insert_own_visible" on public.comments;
create policy "comments_insert_own_visible"
  on public.comments for insert to authenticated
  with check (
    (select auth.uid()) = author_id
    and exists (select 1 from public.posts p
                 where p.id = post_id and public.can_view_post(p.author_id, p.community_id))
  );
