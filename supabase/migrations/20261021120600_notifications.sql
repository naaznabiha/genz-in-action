-- =============================================================================
-- Migration 20261021120600_notifications
-- Phase 3 · Step 7 of 10
-- =============================================================================
-- Creates : • public.notifications (recipient, actor, typed type, typed target,
--             created/read timestamps)
--           • public.create_notification(...) — the ONLY write path, used by
--             trusted triggers (next migrations). Not callable by the app.
-- Depends : Phase 2 user_settings, 20261021120100_visibility_helpers.
-- Safe to re-run : yes.
-- Destructive    : no.
-- Spec    : §10 notifications, §11 MVP in-app types, §12 "Notification rows
--           readable/updateable only by their recipient, with creation handled
--           through trusted database logic". The list screen is Phase 5.
--
-- Rules applied when creating:
--   • never notify yourself, never across a block;
--   • like / comment / follow respect the recipient's Activity Updates switch
--     (user_settings.notify_activity, decision D18);
--   • follow_request and follow_accepted are always created (they need action
--     or confirm one);
--   • repeated like / follow notifications from the same person for the same
--     target are de-duplicated.
-- Community notification types will be added with communities.
-- =============================================================================

create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  actor_id     uuid not null references public.profiles (id) on delete cascade,
  type         text not null
               constraint notifications_type_valid
               check (type in ('like', 'comment', 'follow', 'follow_request', 'follow_accepted')),
  target_type  text not null
               constraint notifications_target_type_valid check (target_type in ('post', 'comment', 'profile')),
  target_id    uuid not null,
  created_at   timestamptz not null default now(),
  read_at      timestamptz,
  constraint notifications_not_self check (recipient_id <> actor_id)
);

create index if not exists notifications_recipient_idx on public.notifications (recipient_id, created_at desc, id desc);
create index if not exists notifications_target_idx on public.notifications (target_type, target_id);
create unique index if not exists notifications_dedupe_idx
  on public.notifications (recipient_id, actor_id, type, target_id)
  where type in ('like', 'follow', 'follow_request', 'follow_accepted');

comment on table public.notifications is 'GenZ in Action: in-app notifications. Created only by trusted triggers; read/marked read by the recipient.';

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
  if p_type in ('like', 'comment', 'follow')
     and exists (select 1 from public.user_settings s
                  where s.user_id = p_recipient and not s.notify_activity) then
    return;
  end if;

  insert into public.notifications (recipient_id, actor_id, type, target_type, target_id)
  values (p_recipient, p_actor, p_type, p_target_type, p_target_id)
  on conflict (recipient_id, actor_id, type, target_id)
    where type in ('like', 'follow', 'follow_request', 'follow_accepted')
    do nothing;
end;
$$;
revoke execute on function public.create_notification(uuid, uuid, text, text, uuid) from public, anon, authenticated;

revoke all on table public.notifications from anon, authenticated;
grant select on table public.notifications to authenticated;
grant update (read_at) on table public.notifications to authenticated;

alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
  on public.notifications for select to authenticated
  using ((select auth.uid()) = recipient_id and public.can_see_profile(actor_id));

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
  on public.notifications for update to authenticated
  using ((select auth.uid()) = recipient_id)
  with check ((select auth.uid()) = recipient_id);
