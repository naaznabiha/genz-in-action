-- =============================================================================
-- Migration 20261024120700_community_realtime
-- Phase 6 · Step 8 of 8
-- =============================================================================
-- Changes : adds community_messages and community_message_pins to the
--           `supabase_realtime` publication, so an open Discussion updates
--           live on every member's phone (spec §13.1: the one place live
--           updates are justified).
-- Depends : 20261024120000_communities_tables.
-- Safe to re-run : yes (adds each table only if missing; does nothing on a
--           database without the publication).
-- Destructive    : no.
--
-- Privacy: Realtime delivers a change only to subscribers who could SELECT the
-- row under RLS — for a private community, its active members; never messages
-- from someone blocked either way. Stars are NOT published (private, and only
-- the person starring needs them). The app treats events as "something
-- changed" and re-reads the page through the API.
-- =============================================================================

do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    return;
  end if;
  foreach t in array array['community_messages', 'community_message_pins'] loop
    if not exists (select 1 from pg_publication_tables
                    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;
