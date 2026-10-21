import { toReadableDataError } from "@/lib/profile-errors";
import { requireSupabaseConfig, supabase } from "@/lib/supabase";
import { USER_SETTINGS_COLUMNS, type UserSettings } from "@/types/settings";

/** The signed-in user's settings row (created by the database for every profile). RLS: own row only. */
export async function fetchMySettings(userId: string): Promise<UserSettings | null> {
  requireSupabaseConfig();
  const { data, error } = await supabase
    .from("user_settings")
    .select(USER_SETTINGS_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(toReadableDataError(error));
  return data as UserSettings | null;
}

export async function setNotifyActivity(userId: string, value: boolean): Promise<void> {
  requireSupabaseConfig();
  const { data, error } = await supabase
    .from("user_settings")
    .update({ notify_activity: value })
    .eq("user_id", userId)
    .select("user_id");
  if (error) throw new Error(toReadableDataError(error));
  // RLS turns a forbidden update into "0 rows" rather than an error; never report that as saved.
  if (!data || data.length === 0) throw new Error("Your settings could not be saved. Log in again and retry.");
}

/** Private Account switch → profiles.is_private (spec FR-10). Follow approval is enforced in M6. */
export async function setPrivateAccount(userId: string, value: boolean): Promise<void> {
  requireSupabaseConfig();
  const { data, error } = await supabase
    .from("profiles")
    .update({ is_private: value })
    .eq("id", userId)
    .select("id");
  if (error) throw new Error(toReadableDataError(error));
  if (!data || data.length === 0) throw new Error("Your privacy setting could not be saved. Log in again and retry.");
}
