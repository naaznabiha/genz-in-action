import { toReadableAuthError } from "@/lib/auth-errors";
import { requireSupabaseConfig, supabase } from "@/lib/supabase";
import { PROFILE_COLUMNS, type Profile } from "@/types/profile";

/** Profile row for a user, or null if it does not exist (yet). RLS: any signed-in user may read profiles. */
export async function fetchProfile(userId: string): Promise<Profile | null> {
  requireSupabaseConfig();
  const { data, error } = await supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", userId).maybeSingle();
  if (error) throw new Error(toReadableAuthError(error));
  return data as Profile | null;
}
