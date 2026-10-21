import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/hooks/use-auth";
import { profileKeys } from "@/hooks/use-profile";
import { fetchMySettings, setNotifyActivity, setPrivateAccount } from "@/services/settings";
import type { Profile } from "@/types/profile";
import type { UserSettings } from "@/types/settings";

export const settingsKeys = {
  mine: (userId: string) => ["settings", userId] as const,
};

export function useMySettings() {
  const { user } = useAuth();
  const userId = user?.id;
  return useQuery({
    queryKey: userId ? settingsKeys.mine(userId) : ["settings", "none"],
    queryFn: () => fetchMySettings(userId as string),
    enabled: Boolean(userId),
  });
}

/**
 * Toggle notify_activity. The switch flips immediately and rolls back if the
 * server rejects the change, so a failed write never looks saved.
 */
export function useSetNotifyActivity() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (value: boolean) => setNotifyActivity(user!.id, value),
    onMutate: async (value) => {
      const key = settingsKeys.mine(user!.id);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<UserSettings | null>(key);
      if (previous) queryClient.setQueryData<UserSettings>(key, { ...previous, notify_activity: value });
      return { previous };
    },
    onError: (_error, _value, context) => {
      if (context?.previous) queryClient.setQueryData(settingsKeys.mine(user!.id), context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: settingsKeys.mine(user!.id) }),
  });
}

/** Toggle profiles.is_private with the same optimistic + rollback behaviour. */
export function useSetPrivateAccount() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (value: boolean) => setPrivateAccount(user!.id, value),
    onMutate: async (value) => {
      const key = profileKeys.detail(user!.id);
      await queryClient.cancelQueries({ queryKey: key, exact: true });
      const previous = queryClient.getQueryData<Profile | null>(key);
      if (previous) queryClient.setQueryData<Profile>(key, { ...previous, is_private: value });
      return { previous };
    },
    onError: (_error, _value, context) => {
      if (context?.previous) queryClient.setQueryData(profileKeys.detail(user!.id), context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: profileKeys.detail(user!.id), exact: true });
      // Privacy changes who can see posts and may auto-accept pending requests.
      void queryClient.invalidateQueries({ queryKey: ["social"] });
      void queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
  });
}
