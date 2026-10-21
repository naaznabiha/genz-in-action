import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/hooks/use-auth";
import {
  fetchEarnedBadges,
  fetchProfile,
  fetchProfileTags,
  fetchTagCatalogue,
  updateMyProfile,
} from "@/services/profile";
import type { ProfileUpdate } from "@/types/profile";

export const profileKeys = {
  all: ["profiles"] as const,
  detail: (userId: string) => ["profiles", userId] as const,
  tags: (userId: string) => ["profiles", userId, "tags"] as const,
  badges: (userId: string) => ["profiles", userId, "badges"] as const,
  catalogue: ["profile-tags", "catalogue"] as const,
};

/** The signed-in user's own profile row. Always keyed by the authenticated user id. */
export function useMyProfile() {
  const { user } = useAuth();
  const userId = user?.id;
  return useQuery({
    queryKey: userId ? profileKeys.detail(userId) : ["profiles", "none"],
    queryFn: () => fetchProfile(userId as string),
    enabled: Boolean(userId),
  });
}

/** The signed-in user's selected tags. */
export function useMyProfileTags() {
  const { user } = useAuth();
  const userId = user?.id;
  return useQuery({
    queryKey: userId ? profileKeys.tags(userId) : ["profiles", "none", "tags"],
    queryFn: () => fetchProfileTags(userId as string),
    enabled: Boolean(userId),
  });
}

/** The signed-in user's earned badges (About tab). */
export function useMyBadges() {
  const { user } = useAuth();
  const userId = user?.id;
  return useQuery({
    queryKey: userId ? profileKeys.badges(userId) : ["profiles", "none", "badges"],
    queryFn: () => fetchEarnedBadges(userId as string),
    enabled: Boolean(userId),
  });
}

/** Tag catalogue for the Edit Profile picker. Changes rarely. */
export function useTagCatalogue() {
  return useQuery({
    queryKey: profileKeys.catalogue,
    queryFn: fetchTagCatalogue,
    staleTime: 10 * 60_000,
  });
}

/** Saves Edit Profile; on success every screen showing the profile or avatar refetches. */
export function useUpdateMyProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (update: ProfileUpdate) => updateMyProfile(update),
    onSuccess: async () => {
      if (!user) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: profileKeys.detail(user.id), exact: true }),
        queryClient.invalidateQueries({ queryKey: profileKeys.tags(user.id) }),
      ]);
    },
  });
}
