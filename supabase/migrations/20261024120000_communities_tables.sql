-- =============================================================================
-- Migration 20261024120000_communities_tables
-- Phase 6 · Step 1 of 8
-- =============================================================================
-- Creates : public.communities, community_members, community_invites,
--           community_messages, community_message_pins,
--           community_message_stars, community_content
-- Changes : public.posts gains community_id (NULL = "Everyone", as before).
-- Depends : Phase 1 profiles, Phase 3 posts.
-- Safe to re-run : yes (IF NOT EXISTS).
-- Destructive    : no.
-- Spec    : §10 communities data model, §11 community rules, decisions D47–D52.
--
-- Rules carried by the schema (the policies come in the next migration):
--   • privacy: public (anyone can read and join) or private (invite-only; the
--     name, description and image stay visible so invites make sense).
--   • roles: owner (exactly one active), admin, member (D48). status keeps the
--     history: active, left, removed — a removed person cannot rejoin a public
--     community by themselves (an admin can invite them back).
--   • messages, content and community posts are KEPT when their author leaves
--     (authors stay linked to their profile; ON DELETE RESTRICT like posts, D31).
--   • pins are shared state; stars are private to each user.
--   • every write goes through RPCs or RLS-checked inserts — no client-set
--     roles, statuses, timestamps or counters.
-- =============================================================================

create table if not exists public.communities (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles (id) on delete restrict,
  name         text not null
               constraint communities_name_length check (char_length(btrim(name)) between 3 and 60),
  description  text not null default ''
               constraint communities_description_length check (char_length(description) <= 500),
  image_path   text
               constraint communities_image_path_format
               check (image_path is null or image_path ~ '^[0-9a-f-]{36}/community-[0-9]{10,16}\.(jpg|png)$'),
  is_private   boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists communities_created_idx on public.communities (created_at desc, id desc);
create index if not exists communities_search_idx on public.communities using gin (to_tsvector('simple', name || ' ' || description));
comment on table public.communities is 'GenZ in Action: communities. Public = anyone reads and joins; private = invite-only (identity stays visible).';

create table if not exists public.community_members (
  community_id uuid not null references public.communities (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  role         text not null default 'member'
               constraint community_members_role_valid check (role in ('owner', 'admin', 'member')),
  status       text not null default 'active'
               constraint community_members_status_valid check (status in ('active', 'left', 'removed')),
  joined_at    timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (community_id, user_id),
  constraint community_members_owner_active check (role <> 'owner' or status = 'active')
);
create unique index if not exists community_members_one_owner
  on public.community_members (community_id) where role = 'owner';
create index if not exists community_members_user_idx on public.community_members (user_id, status);
create index if not exists community_members_active_idx on public.community_members (community_id, status, role);
comment on table public.community_members is 'GenZ in Action: membership with role (owner/admin/member) and status (active/left/removed). Written only by RPCs.';

create table if not exists public.community_invites (
  id            uuid primary key default gen_random_uuid(),
  community_id  uuid not null references public.communities (id) on delete cascade,
  invitee_id    uuid not null references public.profiles (id) on delete cascade,
  inviter_id    uuid not null references public.profiles (id) on delete cascade,
  status        text not null default 'pending'
                constraint community_invites_status_valid check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at    timestamptz not null default now(),
  responded_at  timestamptz,
  constraint community_invites_not_self check (invitee_id <> inviter_id)
);
create unique index if not exists community_invites_one_pending
  on public.community_invites (community_id, invitee_id) where status = 'pending';
create index if not exists community_invites_invitee_idx on public.community_invites (invitee_id, status, created_at desc);
comment on table public.community_invites is 'GenZ in Action: in-app invites to existing users (link invites / join requests deferred, spec §11). Written only by RPCs.';

-- Attachment columns shared by messages and content: image (JPEG/PNG ≤ 5 MB)
-- or PDF (≤ 10 MB), stored in the private community-media bucket under
-- <community id>/<author id>/<file>. Checked by a trigger (media migration).
create table if not exists public.community_messages (
  id                uuid primary key default gen_random_uuid(),
  community_id      uuid not null references public.communities (id) on delete cascade,
  author_id         uuid not null references public.profiles (id) on delete restrict,
  body              text not null default ''
                    constraint community_messages_body_length check (char_length(body) <= 2000),
  attachment_path   text,
  attachment_kind   text constraint community_messages_attachment_kind check (attachment_kind in ('image', 'pdf')),
  attachment_name   text constraint community_messages_attachment_name check (attachment_name is null or char_length(attachment_name) between 1 and 120),
  attachment_size   integer,
  attachment_width  integer constraint community_messages_width check (attachment_width is null or attachment_width between 1 and 10000),
  attachment_height integer constraint community_messages_height check (attachment_height is null or attachment_height between 1 and 10000),
  created_at        timestamptz not null default now(),
  constraint community_messages_not_empty check (char_length(btrim(body)) > 0 or attachment_path is not null),
  constraint community_messages_attachment_complete check ((attachment_path is null) = (attachment_kind is null))
);
create index if not exists community_messages_feed_idx on public.community_messages (community_id, created_at desc, id desc);
comment on table public.community_messages is 'GenZ in Action: live community discussion. Kept when the author leaves.';

create table if not exists public.community_message_pins (
  message_id   uuid primary key references public.community_messages (id) on delete cascade,
  community_id uuid not null references public.communities (id) on delete cascade,
  pinned_by    uuid not null references public.profiles (id) on delete cascade,
  pinned_at    timestamptz not null default now()
);
create index if not exists community_message_pins_community_idx on public.community_message_pins (community_id, pinned_at desc);
comment on table public.community_message_pins is 'GenZ in Action: pinned messages — shared state, changed only by the owner and admins.';

create table if not exists public.community_message_stars (
  message_id uuid not null references public.community_messages (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
create index if not exists community_message_stars_user_idx on public.community_message_stars (user_id, created_at desc);
comment on table public.community_message_stars is 'GenZ in Action: a user''s private starred messages.';

create table if not exists public.community_content (
  id                uuid primary key default gen_random_uuid(),
  community_id      uuid not null references public.communities (id) on delete cascade,
  author_id         uuid not null references public.profiles (id) on delete restrict,
  title             text not null
                    constraint community_content_title_length check (char_length(btrim(title)) between 3 and 120),
  body              text not null default ''
                    constraint community_content_body_length check (char_length(body) <= 5000),
  attachment_path   text,
  attachment_kind   text constraint community_content_attachment_kind check (attachment_kind in ('image', 'pdf')),
  attachment_name   text constraint community_content_attachment_name check (attachment_name is null or char_length(attachment_name) between 1 and 120),
  attachment_size   integer,
  attachment_width  integer constraint community_content_width check (attachment_width is null or attachment_width between 1 and 10000),
  attachment_height integer constraint community_content_height check (attachment_height is null or attachment_height between 1 and 10000),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint community_content_attachment_complete check ((attachment_path is null) = (attachment_kind is null))
);
create index if not exists community_content_feed_idx on public.community_content (community_id, created_at desc, id desc);
comment on table public.community_content is 'GenZ in Action: lasting community content (text, photo, PDF). Kept when the author leaves.';

-- ---------------------------------------------------------------- post audience
alter table public.posts add column if not exists community_id uuid references public.communities (id) on delete cascade;
create index if not exists posts_community_feed_idx on public.posts (community_id, created_at desc, id desc) where community_id is not null;
comment on column public.posts.community_id is 'Audience: NULL = Everyone (account privacy applies); otherwise only this community (D51).';
