-- =============================================================================
-- Migration 20261021120500_post_interactions
-- Phase 3 · Step 6 of 10
-- =============================================================================
-- Creates : • public.post_likes  (one like per user per post — primary key)
--           • public.post_saves  (one save per user per post, private)
--           • public.comments    (flat; author edits/deletes own)
--           • trusted counters: posts.like_count / comment_count kept by triggers
-- Depends : 20261021120200_posts, 20261021120100_visibility_helpers.
-- Safe to re-run : yes.
-- Destructive    : no.
-- Spec    : §10, §11 ("Saved and liked are separate relationships"; "deleting a
--           post removes its likes, saves … comments"; "Comments: authors can
--           edit/delete their own"), FR-09, brief "double-tapping Like never
--           creates two likes" (primary key + ON CONFLICT DO NOTHING in the app).
--
-- Interaction rules: you can like, save or comment only on a post you are
-- allowed to see (the posts RLS reuses can_view_author_content, which also
-- excludes blocked pairs). Comments are hidden from people blocked by / blocking
-- the commenter. Reply threads and comment likes are out of scope (brief).
-- Commenter FK is ON DELETE RESTRICT (authored content, spec §11).
-- =============================================================================

-- ---------------------------------------------------------------- likes
create table if not exists public.post_likes (
  post_id    uuid not null references public.posts (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists post_likes_user_idx on public.post_likes (user_id, created_at desc);

-- ---------------------------------------------------------------- saves
create table if not exists public.post_saves (
  post_id    uuid not null references public.posts (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists post_saves_user_idx on public.post_saves (user_id, created_at desc);

-- ---------------------------------------------------------------- comments
create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts (id) on delete cascade,
  author_id  uuid not null references public.profiles (id) on delete restrict,
  body       text not null
             constraint comments_body_length check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists comments_post_idx on public.comments (post_id, created_at, id);
create index if not exists comments_author_idx on public.comments (author_id);

comment on table public.post_likes is 'GenZ in Action: likes. Counted into posts.like_count by trigger.';
comment on table public.post_saves is 'GenZ in Action: saved posts. Private to the saver.';
comment on table public.comments is 'GenZ in Action: flat comments. Counted into posts.comment_count by trigger.';

-- Comment "Edited": updated_at moves only when the body changes.
create or replace function public.comments_set_edited_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := case when new.body is distinct from old.body then now() else old.updated_at end;
  return new;
end;
$$;
revoke execute on function public.comments_set_edited_at() from public, anon, authenticated;

create or replace trigger comments_set_edited_at
  before update on public.comments
  for each row execute function public.comments_set_edited_at();

-- ---------------------------------------------------------------- trusted counters
create or replace function public.maintain_post_counters()
returns trigger
language plpgsql
security definer          -- the API cannot write counter columns
set search_path = ''
as $$
begin
  if tg_table_name = 'post_likes' then
    if tg_op = 'INSERT' then
      update public.posts set like_count = like_count + 1 where id = new.post_id;
    else
      update public.posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
    end if;
  elsif tg_table_name = 'comments' then
    if tg_op = 'INSERT' then
      update public.posts set comment_count = comment_count + 1 where id = new.post_id;
    else
      update public.posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
    end if;
  end if;
  return null;
end;
$$;
revoke execute on function public.maintain_post_counters() from public, anon, authenticated;

create or replace trigger post_likes_count
  after insert or delete on public.post_likes
  for each row execute function public.maintain_post_counters();

create or replace trigger comments_count
  after insert or delete on public.comments
  for each row execute function public.maintain_post_counters();

-- ---------------------------------------------------------------- privileges
revoke all on table public.post_likes from anon, authenticated;
revoke all on table public.post_saves from anon, authenticated;
revoke all on table public.comments from anon, authenticated;
grant select, delete on table public.post_likes to authenticated;
grant insert (post_id, user_id) on table public.post_likes to authenticated;
grant select, delete on table public.post_saves to authenticated;
grant insert (post_id, user_id) on table public.post_saves to authenticated;
grant select, delete on table public.comments to authenticated;
grant insert (post_id, author_id, body) on table public.comments to authenticated;
grant update (body) on table public.comments to authenticated;

alter table public.post_likes enable row level security;
alter table public.post_saves enable row level security;
alter table public.comments enable row level security;

-- Likes: you see your own likes (for the filled heart); counts come from posts.
drop policy if exists "post_likes_select_own" on public.post_likes;
create policy "post_likes_select_own"
  on public.post_likes for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "post_likes_insert_own_visible" on public.post_likes;
create policy "post_likes_insert_own_visible"
  on public.post_likes for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.posts p
                 where p.id = post_id and public.can_view_author_content(p.author_id))
  );

drop policy if exists "post_likes_delete_own" on public.post_likes;
create policy "post_likes_delete_own"
  on public.post_likes for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Saves: private.
drop policy if exists "post_saves_select_own" on public.post_saves;
create policy "post_saves_select_own"
  on public.post_saves for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "post_saves_insert_own_visible" on public.post_saves;
create policy "post_saves_insert_own_visible"
  on public.post_saves for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.posts p
                 where p.id = post_id and public.can_view_author_content(p.author_id))
  );

drop policy if exists "post_saves_delete_own" on public.post_saves;
create policy "post_saves_delete_own"
  on public.post_saves for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Comments: visible with the post, minus commenters blocked either way.
drop policy if exists "comments_select_visible" on public.comments;
create policy "comments_select_visible"
  on public.comments for select to authenticated
  using (
    public.can_see_profile(author_id)
    and exists (select 1 from public.posts p
                 where p.id = post_id and public.can_view_author_content(p.author_id))
  );

drop policy if exists "comments_insert_own_visible" on public.comments;
create policy "comments_insert_own_visible"
  on public.comments for insert to authenticated
  with check (
    (select auth.uid()) = author_id
    and exists (select 1 from public.posts p
                 where p.id = post_id and public.can_view_author_content(p.author_id))
  );

drop policy if exists "comments_update_own" on public.comments;
create policy "comments_update_own"
  on public.comments for update to authenticated
  using ((select auth.uid()) = author_id)
  with check ((select auth.uid()) = author_id);

drop policy if exists "comments_delete_own" on public.comments;
create policy "comments_delete_own"
  on public.comments for delete to authenticated
  using ((select auth.uid()) = author_id);
