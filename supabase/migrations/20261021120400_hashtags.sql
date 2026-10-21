-- =============================================================================
-- Migration 20261021120400_hashtags
-- Phase 3 · Step 5 of 10
-- =============================================================================
-- Creates : • public.hashtags (canonical, lowercase)
--           • public.post_hashtags (post ↔ hashtag)
--           • public.sync_post_hashtags() + trigger: hashtags typed in a post's
--             title/body (#climate) are detected BY THE DATABASE on create and
--             edit, so the app cannot attach tags that are not in the text.
-- Depends : 20261021120200_posts.
-- Safe to re-run : yes.
-- Destructive    : no.
-- Spec    : §10 hashtags / post_hashtags, FR-13 (hashtag feeds and trending
--           are Phase 4; this provides the data).
--
-- Detection rule (mirrored in mobile/lib/hashtags.ts): '#' at the start or
-- after a non-word character, then 2–50 of [A-Za-z0-9_] containing at least
-- one letter; stored lowercase; at most 20 distinct tags per post.
-- =============================================================================

create table if not exists public.hashtags (
  id         bigint generated always as identity primary key,
  tag        text not null unique
             constraint hashtags_tag_format check (tag ~ '^[a-z0-9_]{2,50}$' and tag ~ '[a-z]'),
  created_at timestamptz not null default now()
);

create table if not exists public.post_hashtags (
  post_id    uuid not null references public.posts (id) on delete cascade,
  hashtag_id bigint not null references public.hashtags (id) on delete restrict,
  primary key (post_id, hashtag_id)
);
create index if not exists post_hashtags_hashtag_idx on public.post_hashtags (hashtag_id);

comment on table public.hashtags is 'GenZ in Action: canonical lowercase hashtags, created automatically from post text.';
comment on table public.post_hashtags is 'GenZ in Action: hashtags detected in a post (maintained by trigger).';

create or replace function public.extract_hashtags(p_text text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(t order by first_pos), '{}')
    from (
      select lower(m[2]) as t, min(ord) as first_pos
        from regexp_matches(coalesce(p_text, ''), '(^|[^A-Za-z0-9_&/])#([A-Za-z0-9_]{2,50})', 'g') with ordinality as r(m, ord)
       where lower(m[2]) ~ '[a-z]'
       group by lower(m[2])
       order by min(ord)
       limit 20
    ) s;
$$;
comment on function public.extract_hashtags(text) is 'GenZ in Action: distinct lowercase hashtags in text (max 20, in order of appearance).';

create or replace function public.sync_post_hashtags()
returns trigger
language plpgsql
security definer          -- writes hashtags/post_hashtags, which the API cannot write
set search_path = ''
as $$
declare
  tags text[] := public.extract_hashtags(new.title || ' ' || new.body);
begin
  if tg_op = 'UPDATE' and new.title = old.title and new.body = old.body then
    return null;
  end if;

  insert into public.hashtags (tag)
  select t from unnest(tags) as t
  on conflict (tag) do nothing;

  delete from public.post_hashtags ph
   using public.hashtags h
   where ph.post_id = new.id and h.id = ph.hashtag_id and not (h.tag = any (tags));

  insert into public.post_hashtags (post_id, hashtag_id)
  select new.id, h.id from public.hashtags h where h.tag = any (tags)
  on conflict do nothing;

  return null;
end;
$$;
revoke execute on function public.sync_post_hashtags() from public, anon, authenticated;

create or replace trigger posts_sync_hashtags
  after insert or update of title, body on public.posts
  for each row execute function public.sync_post_hashtags();

revoke all on table public.hashtags from anon, authenticated;
revoke all on table public.post_hashtags from anon, authenticated;
grant select on table public.hashtags to authenticated;
grant select on table public.post_hashtags to authenticated;

alter table public.hashtags enable row level security;
alter table public.post_hashtags enable row level security;

-- A hashtag's text is post content: it is visible only while at least one post
-- the viewer may see uses it (post_hashtags' own RLS applies inside), so a tag
-- typed only in a private account's posts never leaks to non-followers.
drop policy if exists "hashtags_select_authenticated" on public.hashtags;
drop policy if exists "hashtags_select_visible" on public.hashtags;
create policy "hashtags_select_visible"
  on public.hashtags for select to authenticated
  using (exists (select 1 from public.post_hashtags ph where ph.hashtag_id = hashtags.id));

drop policy if exists "post_hashtags_select_visible" on public.post_hashtags;
create policy "post_hashtags_select_visible"
  on public.post_hashtags for select to authenticated
  using (exists (select 1 from public.posts p
                  where p.id = post_id and public.can_view_author_content(p.author_id)));
