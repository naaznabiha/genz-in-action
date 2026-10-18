import { focusManager, QueryClient } from "@tanstack/react-query";
import { AppState, Platform, type AppStateStatus } from "react-native";

/**
 * Shared TanStack Query client (spec §13.1, decision D7). Server state lives
 * here, not in React context. Query keys live next to the hooks that use them.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
    },
    mutations: {
      retry: 0,
    },
  },
});

// React Native has no window focus: refetch stale queries when the app returns to the foreground.
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (status: AppStateStatus) => {
    focusManager.setFocused(status === "active");
  });
}
