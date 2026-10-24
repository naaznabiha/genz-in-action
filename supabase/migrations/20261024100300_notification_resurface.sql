-- =============================================================================
-- Migration 20261024100300_notification_resurface
-- Phase 5 · Step 4 of 4
-- =============================================================================
-- Changes : public.create_notification(...) (Phase 3) — same signature, same
--           rules, one fix: a repeated "your follow request was accepted"
--           now comes back as NEW (unread, current time) instead of being
--           silently dropped.
-- Depends : 20261021120600_notifications.
-- Safe to re-run : yes (CREATE OR REPLACE). If you ever re-run the Phase 3
--           file 20261021120600_notifications.sql, re-run this file after it.
-- Destructive    : no.
--
-- Why: Phase 3 de-duplicates like / follow / follow_request / follow_accepted
-- by (recipient, actor, type, target). That is right for likes and follows
-- (unlike → like again, or unfollow → follow again, must not spam), and a
-- handled follow request is deleted, so a new request always notifies. But an
-- accepted-request notification stays, so if B requested again later (after
-- unfollowing a private account) and A accepted again, B was never told.
-- Found by 96_rls_smoke_test_phase5.sql. Rules otherwise unchanged: never to
-- yourself, never across a block, like/comment/follow respect Activity Updates.
-- =============================================================================

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
    do update set created_at = now(), read_at = null
     where public.notifications.type = 'follow_accepted';   -- likes / follows stay de-duplicated
end;
$$;

revoke execute on function public.create_notification(uuid, uuid, text, text, uuid) from public, anon, authenticated;
