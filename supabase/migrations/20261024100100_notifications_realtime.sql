-- =============================================================================
-- Migration 20261024100100_notifications_realtime
-- Phase 5 · Step 2 of 4
-- =============================================================================
-- Changes : adds public.notifications to the `supabase_realtime` publication,
--           so the app can refresh the bell badge the moment a notification
--           arrives (optional per the Phase 5 brief).
-- Depends : Phase 3 notifications.
-- Safe to re-run : yes (only adds the table if it is not there yet; does
--           nothing on a database without the publication).
-- Destructive    : no.
--
-- Privacy: Supabase Realtime only delivers a change to a subscriber who could
-- SELECT that row under RLS — i.e. the recipient, and not when the actor is
-- blocked either way (notifications_select_own). The app only uses the event
-- as a "something changed" signal and re-reads the count through the API.
-- The badge also refreshes whenever the app returns to the foreground, so it
-- stays correct even if Realtime is unavailable.
-- =============================================================================

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;
