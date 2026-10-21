/**
 * Social graph shapes (supabase/migrations/20261021121000_follow_block_rpcs.sql).
 * Relationship is from the viewer's side; a user who blocked the viewer is
 * simply "not found" (the block is never revealed).
 */
export type Relationship = "self" | "following" | "requested" | "none" | "blocked_by_me";

export type ProfileSummary = {
  id: string;
  username: string;
  display_name: string;
  bio: string | null;
  avatar_path: string | null;
  location: string | null;
  is_private: boolean;
  created_at: string;
  follower_count: number;
  following_count: number;
  post_count: number;
  total_actions: number;
  relationship: Relationship;
  can_view_content: boolean;
};

export type PersonRow = {
  id: string;
  username: string;
  display_name: string;
  avatar_path: string | null;
};

export type FollowRequest = PersonRow & { requested_at: string };
export type BlockedUser = PersonRow & { blocked_at: string };
export type SuggestedPerson = PersonRow & { is_private: boolean; follower_count: number };
