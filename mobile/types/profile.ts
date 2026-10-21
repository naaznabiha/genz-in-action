/**
 * Row shape of public.profiles (supabase/migrations/20261018120100_profiles.sql
 * + 20261021100300_profile_avatar_path.sql).
 * Follower counts, impact points, tags and badges are NOT stored here: per the
 * spec they are derived from their own tables (decision D11).
 * `avatar_url` (Phase 1) is deprecated and not selected; the photo is the
 * storage object at `avatar_path` (decision D20).
 */
export type Profile = {
  id: string;
  username: string;
  display_name: string;
  bio: string | null;
  avatar_path: string | null;
  location: string | null;
  is_private: boolean;
  created_at: string;
  updated_at: string;
};

export const PROFILE_COLUMNS =
  "id, username, display_name, bio, avatar_path, location, is_private, created_at, updated_at";

/** Row of public.profile_tags (the selectable catalogue). */
export type ProfileTag = {
  id: string;
  label: string;
  sort_order: number;
};

export const PROFILE_TAG_COLUMNS = "id, label, sort_order";

/** Row of public.badges joined through public.user_badges. */
export type EarnedBadge = {
  id: string;
  name: string;
  description: string | null;
  emoji: string | null;
  awarded_at: string;
};

/** Everything Edit Profile saves in one call (public.update_my_profile). */
export type ProfileUpdate = {
  displayName: string;
  username: string;
  bio: string;
  location: string;
  avatarPath: string | null;
  tagIds: string[];
};
