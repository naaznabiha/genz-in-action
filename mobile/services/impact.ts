import { toReadableDataError } from "@/lib/profile-errors";
import { requireSupabaseConfig, supabase } from "@/lib/supabase";
import type { ImpactSummary } from "@/types/impact";

/**
 * The signed-in user's impact summary, computed by the database from the
 * append-only activity ledger (public.get_my_impact_summary). The app never
 * calculates or stores scores itself (spec FR-07, §13).
 */
export async function fetchMyImpactSummary(): Promise<ImpactSummary> {
  requireSupabaseConfig();
  const { data, error } = await supabase.rpc("get_my_impact_summary");
  if (error) throw new Error(toReadableDataError(error));
  const row = (Array.isArray(data) ? data[0] : data) as ImpactSummary | undefined;
  if (!row) throw new Error("Impact summary is unavailable right now.");
  return row;
}
