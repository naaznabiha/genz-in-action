-- =============================================================================
-- Migration 20261021100700_impact_stats
-- Phase 2 · Step 8 of 8
-- =============================================================================
-- Creates : • public.impact_scoring_versions — versioned scoring configuration
--             (EMPTY: no formula is approved yet)
--           • public.impact_event_weights    — points per event type per version
--             (EMPTY)
--           • public.get_my_impact_summary() — the caller's stats, derived from
--             the activity ledger at read time. Nothing is stored on profiles,
--             so nothing can be edited by the client.
-- Depends : 20261021100500_activity_ledger.
-- Safe to re-run : yes.
-- Destructive    : no.
-- Spec    : FR-07, §13 ("Event weights live in a versioned configuration…
--           must be approved before the ranking feature is released").
--
-- Implementation boundary (see docs/impact-scoring.md):
--   BUILT NOW  • ledger + trusted write path (previous migration)
--              • versioned weights tables + a summary function that sums the
--                weights of an APPROVED version over that version's week
--              • all-time action count (a plain count, not a score)
--   NOT BUILT  • any weights, qualifying actions, week start or time zone
--                values — these are product decisions (spec §18)
--              • streak (needs approved cadence + time zone) → always NULL
--              • rank   (needs approved population + score) → always NULL
--   With no approved version the function returns formula_status =
--   'pending_approval' and NULL points, so the app shows a "getting started"
--   state instead of a number.
--
-- Approving a formula later = one new migration that inserts a version row with
-- status 'approved' plus its weight rows. Old events are re-scored automatically
-- because scores are computed at read time.
-- =============================================================================

create table if not exists public.impact_scoring_versions (
  version        integer primary key constraint impact_scoring_versions_version_positive check (version > 0),
  status         text not null default 'draft'
                 constraint impact_scoring_versions_status check (status in ('draft', 'approved', 'retired')),
  -- ISO day of week the "week" starts on (1 = Monday … 7 = Sunday).
  week_starts_on smallint not null
                 constraint impact_scoring_versions_week_start check (week_starts_on between 1 and 7),
  -- IANA zone used to cut weeks, e.g. 'UTC'.
  time_zone      text not null,
  approved_at    timestamptz,
  approved_by    text,
  notes          text,
  created_at     timestamptz not null default now(),
  constraint impact_scoring_versions_approval check (status <> 'approved' or (approved_at is not null and approved_by is not null))
);

create table if not exists public.impact_event_weights (
  version    integer not null references public.impact_scoring_versions (version) on delete restrict,
  event_type text not null references public.activity_event_types (id) on delete restrict,
  points     integer not null constraint impact_event_weights_points_range check (points between 0 and 10000),
  primary key (version, event_type)
);

comment on table public.impact_scoring_versions is
  'GenZ in Action: versioned impact formula. Only status=approved rows are used. Managed by migrations only.';
comment on table public.impact_event_weights is
  'GenZ in Action: points per activity event type for a scoring version. Managed by migrations only.';

-- Configuration is not exposed through the API at all.
revoke all on table public.impact_scoring_versions from anon, authenticated;
revoke all on table public.impact_event_weights from anon, authenticated;
alter table public.impact_scoring_versions enable row level security;
alter table public.impact_event_weights enable row level security;
-- (No policies: API roles have no privileges; the summary function reads as owner.)

create or replace function public.get_my_impact_summary()
returns table (
  formula_status   text,         -- 'approved' | 'pending_approval'
  scoring_version  integer,      -- null while pending
  period_start     timestamptz,  -- null while pending
  period_end       timestamptz,  -- null while pending
  impact_points    integer,      -- null while pending
  period_actions   integer,      -- weighted events in the period; null while pending
  total_actions    integer,      -- all events in the ledger for this user (plain count)
  streak           integer,      -- always null until cadence is approved
  rank             integer       -- always null until ranking is approved
)
language plpgsql
stable
security definer          -- reads scoring config the caller cannot see; only ever for auth.uid()
set search_path = ''
as $$
declare
  uid       uuid := auth.uid();
  v         public.impact_scoring_versions%rowtype;
  local_now timestamp;
  days_back integer;
begin
  if uid is null then
    raise exception using errcode = '42501', message = 'GENZ_NOT_SIGNED_IN: sign in to see your impact';
  end if;

  select count(*)::integer into total_actions
    from public.activity_events e where e.user_id = uid;

  select * into v
    from public.impact_scoring_versions s
   where s.status = 'approved'
   order by s.version desc
   limit 1;

  if not found then
    formula_status := 'pending_approval';
    return next;
    return;
  end if;

  formula_status  := 'approved';
  scoring_version := v.version;
  local_now       := now() at time zone v.time_zone;
  days_back       := (extract(isodow from local_now)::integer - v.week_starts_on + 7) % 7;
  period_start    := (date_trunc('day', local_now) - make_interval(days => days_back)) at time zone v.time_zone;
  period_end      := period_start + interval '7 days';

  select coalesce(sum(w.points), 0)::integer, count(*)::integer
    into impact_points, period_actions
    from public.activity_events e
    join public.impact_event_weights w
      on w.version = v.version and w.event_type = e.event_type
   where e.user_id = uid
     and e.occurred_at >= period_start
     and e.occurred_at <  period_end;

  return next;
end;
$$;

comment on function public.get_my_impact_summary() is
  'GenZ in Action: the caller''s impact summary derived from activity_events and the latest APPROVED scoring version.';

revoke execute on function public.get_my_impact_summary() from public, anon;
grant execute on function public.get_my_impact_summary() to authenticated;
