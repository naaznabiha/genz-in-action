import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { discoveryKeys } from "@/hooks/discovery-keys";
import { useAuth } from "@/hooks/use-auth";
import { postKeys } from "@/hooks/use-posts";
import {
  acceptFollowRequest,
  blockUser,
  fetchMyBlockedUsers,
  fetchMyFollowRequests,
  fetchProfileSummary,
  fetchSuggestedPeople,
  fetchUserTags,
  followUser,
  rejectFollowRequest,
  unblockUser,
  unfollowUser,
} from "@/services/social";
import type { ProfileSummary } from "@/types/social";

export const socialKeys = {
  all: ["social"] as const,
  summary: (userId: string) => ["social", "summary", userId] as const,
  tags: (userId: string) => ["social", "tags", userId] as const,
  requests: ["social", "requests"] as const,
  blocked: ["social", "blocked"] as const,
  suggested: ["social", "suggested"] as const,
  // Discovery people lists (Phase 4) — under "social" so follow/block refreshes them.
  search: (query: string) => ["social", "search", query] as const,
  people: ["social", "people"] as const,
};

export function useProfileSummary(userId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: socialKeys.summary(userId ?? "none"),
    queryFn: () => fetchProfileSummary(userId as string),
    enabled: Boolean(userId && user),
  });
}

export function useUserTags(userId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: socialKeys.tags(userId ?? "none"),
    queryFn: () => fetchUserTags(userId as string),
    enabled: Boolean(userId) && enabled,
  });
}

/** Who can see what may have changed: refresh profiles, people lists, every post list and tag counts. */
function invalidateGraph(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: socialKeys.all });
  void queryClient.invalidateQueries({ queryKey: postKeys.all });
  void queryClient.invalidateQueries({ queryKey: discoveryKeys.all });
}

/** Follow / Requested / Following button. `follow=false` unfollows or cancels a request. */
export function useFollowToggle(targetId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (follow: boolean) => (follow ? followUser(targetId) : unfollowUser(targetId)),
    onSuccess: (relationship) => {
      queryClient.setQueryData<ProfileSummary | null>(socialKeys.summary(targetId), (prev) =>
        prev ? { ...prev, relationship } : prev,
      );
      invalidateGraph(queryClient);
    },
  });
}

export function useFollowRequests() {
  const { user } = useAuth();
  return useQuery({ queryKey: socialKeys.requests, queryFn: fetchMyFollowRequests, enabled: Boolean(user) });
}

export function useRespondToRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ requesterId, accept }: { requesterId: string; accept: boolean }) =>
      accept ? acceptFollowRequest(requesterId) : rejectFollowRequest(requesterId),
    onSettled: () => invalidateGraph(queryClient),
  });
}

export function useBlockedUsers() {
  const { user } = useAuth();
  return useQuery({ queryKey: socialKeys.blocked, queryFn: fetchMyBlockedUsers, enabled: Boolean(user) });
}

export function useBlockToggle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, block }: { userId: string; block: boolean }) => (block ? blockUser(userId) : unblockUser(userId)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["comments"] });
      invalidateGraph(queryClient);
    },
  });
}

export function useSuggestedPeople() {
  const { user } = useAuth();
  return useQuery({ queryKey: socialKeys.suggested, queryFn: () => fetchSuggestedPeople(6), enabled: Boolean(user) });
}
