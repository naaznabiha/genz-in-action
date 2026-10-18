import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/hooks/use-auth";
import { fetchProfile } from "@/services/profile";

export const profileKeys = {
  all: ["profiles"] as const,
  detail: (userId: string) => ["profiles", userId] as const,
};

/** The signed-in user's own profile row. */
export function useMyProfile() {
  const { user } = useAuth();
  const userId = user?.id;
  return useQuery({
    queryKey: userId ? profileKeys.detail(userId) : ["profiles", "none"],
    queryFn: () => fetchProfile(userId as string),
    enabled: Boolean(userId),
  });
}
