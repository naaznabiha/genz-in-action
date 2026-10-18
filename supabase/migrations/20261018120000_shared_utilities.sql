-- =============================================================================
-- Migration 20261018120000_shared_utilities
-- Phase 1 · Step 1 of 4
-- =============================================================================
-- Creates : public.set_updated_at()  — generic BEFORE UPDATE trigger function
--           that stamps updated_at = now(). Reused by every table that has an
--           updated_at column (profiles now; posts, comments, … later).
-- Depends : nothing.
-- Safe to re-run : yes (CREATE OR REPLACE; no data touched).
-- Destructive    : no.
-- =============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'GenZ in Action: BEFORE UPDATE trigger that sets updated_at = now().';

-- Trigger functions are never called directly; do not expose them over the API.
-- (Supabase grants EXECUTE on new public functions to anon/authenticated by default.)
revoke execute on function public.set_updated_at() from public, anon, authenticated;
