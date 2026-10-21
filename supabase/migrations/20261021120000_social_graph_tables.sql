-- =============================================================================
-- Migration 20261021120000_social_graph_tables
-- Phase 3 · Step 1 of 10
-- =============================================================================
-- Creates : public.follows, public.follow_requests, public.blocks
-- Depends : Phase 1 (public.profiles).
-- Safe to re-run : yes.
-- Destructive    : no.
-- Spec    : §10 follows / follow_requests / blocks, §11 follow + block rules,
--           FR-11, FR-20.
--
-- These tables come first because the visibility helpers (next migration),
-- which every post/comment/like rule reuses, read them.
-- Writes happen ONLY through the SECURITY DEFINER functions in
-- 20261021121000_follow_block_rpcs.sql, which apply the spec rules (private
-- accounts need approval; blocking removes follows and requests both ways;
-- blocked pairs cannot follow/request). The API has no INSERT/UPDATE/DELETE.
-- Relationship rows are removed with either profile (ON DELETE CASCADE): they
-- are not authored content (spec §11 deletion baseline).
-- =============================================================================

create table if not exists public.follows (
  follower_id  uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint follows_not_self check (follower_id <> following_id)
);
create index if not exists follows_following_idx on public.follows (following_id, created_at desc);

create table if not exists public.follow_requests (
  requester_id uuid not null references public.profiles (id) on delete cascade,
  target_id    uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (requester_id, target_id),
  constraint follow_requests_not_self check (requester_id <> target_id)
);
create index if not exists follow_requests_target_idx on public.follow_requests (target_id, created_at desc);

create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_not_self check (blocker_id <> blocked_id)
);
create index if not exists blocks_blocked_idx on public.blocks (blocked_id);

comment on table public.follows is 'GenZ in Action: accepted follower → following relationships. Written only by follow RPCs.';
comment on table public.follow_requests is 'GenZ in Action: pending requests to follow a private account. Written only by follow RPCs.';
comment on table public.blocks is 'GenZ in Action: blocker → blocked. Written only by block RPCs. Private to the blocker.';

-- Privileges: read-only for signed-in users, and only rows they are part of.
revoke all on table public.follows from anon, authenticated;
revoke all on table public.follow_requests from anon, authenticated;
revoke all on table public.blocks from anon, authenticated;
grant select on table public.follows to authenticated;
grant select on table public.follow_requests to authenticated;
grant select on table public.blocks to authenticated;

alter table public.follows enable row level security;
alter table public.follow_requests enable row level security;
alter table public.blocks enable row level security;

drop policy if exists "follows_select_involved" on public.follows;
create policy "follows_select_involved"
  on public.follows for select to authenticated
  using ((select auth.uid()) in (follower_id, following_id));

drop policy if exists "follow_requests_select_involved" on public.follow_requests;
create policy "follow_requests_select_involved"
  on public.follow_requests for select to authenticated
  using ((select auth.uid()) in (requester_id, target_id));

-- The blocked person must not learn they were blocked: only the blocker sees the row.
drop policy if exists "blocks_select_own" on public.blocks;
create policy "blocks_select_own"
  on public.blocks for select to authenticated
  using ((select auth.uid()) = blocker_id);
