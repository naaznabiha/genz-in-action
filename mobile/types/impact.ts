/**
 * Result of public.get_my_impact_summary() (supabase/migrations/20261021100700_impact_stats.sql).
 * Everything is derived from the activity ledger on the server; the app only displays it.
 * While no scoring formula is approved, `formula_status` is "pending_approval" and
 * points/period fields are null — the UI must show a getting-started state, never a number.
 */
export type ImpactSummary = {
  formula_status: "approved" | "pending_approval";
  scoring_version: number | null;
  period_start: string | null;
  period_end: string | null;
  impact_points: number | null;
  period_actions: number | null;
  /** Plain count of the user's ledger events (not a score). */
  total_actions: number;
  /** Always null until a streak cadence is approved. */
  streak: number | null;
  /** Always null until a ranking formula is approved. */
  rank: number | null;
};
