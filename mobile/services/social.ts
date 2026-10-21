import { toPostError } from "@/lib/post-errors";
import { requireSupabaseConfig, supabase } from "@/lib/supabase";
import type { ProfileTag } from "@/types/profile";
import type { BlockedUser, FollowRequest, ProfileSummary, Relationship, SuggestedPerson } from "@/types/social";

/** Profile header + counts + relationship. Null = not found, or that user blocked the viewer. */
export async function fetchProfileSummary(userId: string): Promise<ProfileSummary | null> {
  requireSupabaseConfig();
  const { data, error } = await supabase.rpc("get_profile_summary", { p_user_id: userId });
  if (error) throw toPostError(error);
  const rows = (data ?? []) as ProfileSummary[];
  return rows[0] ?? null;
}

/** Tags shown on someone's profile (RLS hides them across a block). */
export async function fetchUserTags(userId: string): Promise<ProfileTag[]> {
  requireSupabaseConfig();
  const { data, error } = await supabase
    .from("user_profile_tags")
    .select("tag:profile_tags(id, label, sort_order)")
    .eq("user_id", userId);
  if (error) throw toPostError(error);
  return ((data ?? []) as unknown as { tag: ProfileTag | null }[])
    .map((r) => r.tag)
    .filter((t): t is ProfileTag => Boolean(t))
    .sort((a, b) => a.sort_order - b.sort_order);
}

/** Public account → 'following' immediately; private → 'requested' (spec §5.6). */
export async function followUser(userId: string): Promise<Relationship> {
  requireSupabaseConfig();
  const { data, error } = await supabase.rpc("follow_user", { p_target: userId });
  if (error) throw toPostError(error);
  return data as Relationship;
}

/** Unfollow, or cancel a pending request. */
export async function unfollowUser(userId: string): Promise<Relationship> {
  requireSupabaseConfig();
  const { data, error } = await supabase.rpc("unfollow_user", { p_target: userId });
  if (error) throw toPostError(error);
  return data as Relationship;
}

export async function fetchMyFollowRequests(): Promise<FollowRequest[]> {
  requireSupabaseConfig();
  const { data, error } = await supabase.rpc("get_my_follow_requests");
  if (error) throw toPostError(error);
  return ((data ?? []) as (Omit<FollowRequest, "id"> & { requester_id: string })[]).map((r) => ({
    id: r.requester_id,
    username: r.username,
    display_name: r.display_name,
    avatar_path: r.avatar_path,
    requested_at: r.requested_at,
  }));
}

export async function acceptFollowRequest(requesterId: string) {
  requireSupabaseConfig();
  const { error } = await supabase.rpc("accept_follow_request", { p_requester: requesterId });
  if (error) throw toPostError(error);
}

export async function rejectFollowRequest(requesterId: string) {
  requireSupabaseConfig();
  const { error } = await supabase.rpc("reject_follow_request", { p_requester: requesterId });
  if (error) throw toPostError(error);
}

/** Blocks: removes follows and requests both ways (database rule, spec §11). */
export async function blockUser(userId: string) {
  requireSupabaseConfig();
  const { error } = await supabase.rpc("block_user", { p_target: userId });
  if (error) throw toPostError(error);
}

export async function unblockUser(userId: string) {
  requireSupabaseConfig();
  const { error } = await supabase.rpc("unblock_user", { p_target: userId });
  if (error) throw toPostError(error);
}

export async function fetchMyBlockedUsers(): Promise<BlockedUser[]> {
  requireSupabaseConfig();
  const { data, error } = await supabase.rpc("get_my_blocked_users");
  if (error) throw toPostError(error);
  return ((data ?? []) as (Omit<BlockedUser, "id"> & { user_id: string })[]).map((r) => ({
    id: r.user_id,
    username: r.username,
    display_name: r.display_name,
    avatar_path: r.avatar_path,
    blocked_at: r.blocked_at,
  }));
}

export async function fetchSuggestedPeople(limit = 6): Promise<SuggestedPerson[]> {
  requireSupabaseConfig();
  const { data, error } = await supabase.rpc("get_suggested_people", { p_limit: limit });
  if (error) throw toPostError(error);
  return (data ?? []) as SuggestedPerson[];
}
