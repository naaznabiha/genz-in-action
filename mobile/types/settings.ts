/**
 * Row shape of public.user_settings (supabase/migrations/20261021100100_user_settings.sql).
 * Only preferences with a defined purpose are stored (decision D18). The Private
 * Account switch is profiles.is_private, not a settings column.
 */
export type UserSettings = {
  user_id: string;
  /** In-app notifications for likes, comments and new followers (honoured once notifications launch). */
  notify_activity: boolean;
  updated_at: string;
};

export const USER_SETTINGS_COLUMNS = "user_id, notify_activity, updated_at";
