/**
 * Row shape of public.profiles (supabase/migrations/20261018120100_profiles.sql).
 * Follower counts, impact points, tags and badges are NOT stored here: per the
 * spec they are derived from their own tables in later phases.
 */
export type Profile = {
  id: string;
  username: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  location: string | null;
  is_private: boolean;
  created_at: string;
  updated_at: string;
};

export const PROFILE_COLUMNS =
  "id, username, display_name, bio, avatar_url, location, is_private, created_at, updated_at";
