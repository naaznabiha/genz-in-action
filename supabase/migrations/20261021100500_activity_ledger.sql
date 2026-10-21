-- =============================================================================
-- Migration 20261021100500_activity_ledger
-- Phase 2 · Step 6 of 8
-- =============================================================================
-- Creates : • public.activity_event_types — catalogue of qualifying action types
--             (EMPTY: types are added with the features that emit them)
--           • public.activity_events — append-only ledger of genuine actions
--           • public.record_activity_event(...) — the ONLY write path, callable
--             by trusted triggers/functions and service_role, never by the app
--           • append-only guards (no UPDATE, no TRUNCATE, DELETE only when the
--             user's profile is being deleted)
-- Depends : Phase 1 (public.profiles).
-- Safe to re-run : yes.
-- Destructive    : no.
-- Spec    : §12 "The client must not directly create activity_events",
--           §13 "append-only activity_events ledger generated only by trusted
--           database/server-side side effects of real actions", FR-07.
--
-- Nothing in Phase 2 writes to this ledger, and no fake events are seeded.
-- Phase 3 (posts, likes, comments, shares…) will, in its own migrations:
--   1. insert the event type(s) into activity_event_types, and
--   2. add an AFTER INSERT trigger on the source table that calls
--      public.record_activity_event(new.author_id, '<type>', '<table>', new.id::text, ...).
-- =============================================================================

-- 1. Event type catalogue -------------------------------------------------------
create table if not exists public.activity_event_types (
  id          text primary key
              constraint activity_event_types_id_format check (id ~ '^[a-z][a-z0-9_]{2,40}$'),
  label       text not null
              constraint activity_event_types_label_length check (char_length(btrim(label)) between 1 and 60),
  description text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

comment on table public.activity_event_types is
  'GenZ in Action: qualifying action types for the impact ledger. Added by migrations alongside the feature that emits them.';

-- 2. Ledger ------------------------------------------------------------------------
create table if not exists public.activity_events (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  event_type   text not null references public.activity_event_types (id) on delete restrict,
  -- What caused the event, e.g. ('posts', '<post uuid>'). Text so any key type fits.
  source_table text not null
               constraint activity_events_source_table_format check (source_table ~ '^[a-z][a-z0-9_]{1,62}$'),
  source_id    text not null
               constraint activity_events_source_id_length check (char_length(source_id) between 1 and 128),
  -- Optional idempotency key so a retried trigger cannot count the same action twice.
  dedupe_key   text unique
               constraint activity_events_dedupe_key_length check (dedupe_key is null or char_length(dedupe_key) <= 200),
  metadata     jsonb not null default '{}'::jsonb,
  occurred_at  timestamptz not null default now()
);

create index if not exists activity_events_user_time_idx on public.activity_events (user_id, occurred_at desc);
create index if not exists activity_events_type_time_idx on public.activity_events (event_type, occurred_at desc);

comment on table public.activity_events is
  'GenZ in Action: append-only ledger of genuine user actions. Written only by public.record_activity_event() from trusted code.';

-- 3. Append-only guards ---------------------------------------------------------
create or replace function public.activity_events_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception using errcode = '42501', message = 'GENZ_LEDGER_APPEND_ONLY: activity events cannot be changed';
  elsif tg_op = 'DELETE' then
    -- Allowed only as part of deleting the user's profile (ON DELETE CASCADE runs
    -- after the parent row is gone). Account deletion is a privileged workflow.
    if exists (select 1 from public.profiles p where p.id = old.user_id) then
      raise exception using errcode = '42501', message = 'GENZ_LEDGER_APPEND_ONLY: activity events cannot be deleted';
    end if;
    return old;
  elsif tg_op = 'TRUNCATE' then
    raise exception using errcode = '42501', message = 'GENZ_LEDGER_APPEND_ONLY: activity events cannot be truncated';
  end if;
  return null;
end;
$$;

revoke execute on function public.activity_events_append_only() from public, anon, authenticated;

create or replace trigger activity_events_no_update
  before update on public.activity_events
  for each row execute function public.activity_events_append_only();

create or replace trigger activity_events_no_delete
  before delete on public.activity_events
  for each row execute function public.activity_events_append_only();

create or replace trigger activity_events_no_truncate
  before truncate on public.activity_events
  for each statement execute function public.activity_events_append_only();

-- 4. The single trusted write path ---------------------------------------------------
create or replace function public.record_activity_event(
  p_user_id      uuid,
  p_event_type   text,
  p_source_table text,
  p_source_id    text,
  p_dedupe_key   text default null,
  p_metadata     jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id bigint;
begin
  if not exists (select 1 from public.activity_event_types t where t.id = p_event_type and t.is_active) then
    raise exception using errcode = '22023', message = 'GENZ_UNKNOWN_EVENT_TYPE: ' || coalesce(p_event_type, '<null>');
  end if;

  insert into public.activity_events (user_id, event_type, source_table, source_id, dedupe_key, metadata)
  values (p_user_id, p_event_type, p_source_table, p_source_id, p_dedupe_key, coalesce(p_metadata, '{}'::jsonb))
  on conflict (dedupe_key) do nothing
  returning id into new_id;

  return new_id;  -- null when the dedupe key was already recorded
end;
$$;

comment on function public.record_activity_event(uuid, text, text, text, text, jsonb) is
  'GenZ in Action: the only way to append to activity_events. Not callable by anon/authenticated.';

revoke execute on function public.record_activity_event(uuid, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.record_activity_event(uuid, text, text, text, text, jsonb) to service_role;

-- 5. Privileges + RLS ------------------------------------------------------------------
-- Users may read their OWN events (transparency); nobody writes through the API.
revoke all on table public.activity_event_types from anon, authenticated;
grant select on table public.activity_event_types to authenticated;

revoke all on table public.activity_events from anon, authenticated;
grant select on table public.activity_events to authenticated;

alter table public.activity_event_types enable row level security;
alter table public.activity_events enable row level security;

drop policy if exists "activity_event_types_select_authenticated" on public.activity_event_types;
create policy "activity_event_types_select_authenticated"
  on public.activity_event_types for select to authenticated
  using (true);

drop policy if exists "activity_events_select_own" on public.activity_events;
create policy "activity_events_select_own"
  on public.activity_events for select to authenticated
  using ((select auth.uid()) = user_id);
