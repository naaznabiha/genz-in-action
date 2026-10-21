import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/hooks/use-auth";
import { fetchMyImpactSummary } from "@/services/impact";

export const impactKeys = {
  mine: (userId: string) => ["impact", userId] as const,
};

/** Server-derived impact summary for the signed-in user (Home card + profile stats). */
export function useMyImpactSummary() {
  const { user } = useAuth();
  const userId = user?.id;
  return useQuery({
    queryKey: userId ? impactKeys.mine(userId) : ["impact", "none"],
    queryFn: fetchMyImpactSummary,
    enabled: Boolean(userId),
  });
}
