import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useEffect } from "react";

import { useAuth } from "@/hooks/use-auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { fetchNotifications, fetchUnreadCount, markAllNotificationsRead, markNotificationRead } from "@/services/notifications";
import type { NotificationCursor, NotificationItem, NotificationPage } from "@/types/notification";

export const notificationKeys = {
  all: ["notifications"] as const,
  list: ["notifications", "list"] as const,
  unread: ["notifications", "unread"] as const,
};

type ListCache = InfiniteData<NotificationPage, NotificationCursor | null>;

/** Notifications list, newest first, 30 per page. */
export function useNotifications() {
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: notificationKeys.list,
    queryFn: ({ pageParam }: { pageParam: NotificationCursor | null }) => fetchNotifications(pageParam),
    initialPageParam: null as NotificationCursor | null,
    getNextPageParam: (last: NotificationPage) => last.nextCursor,
    enabled: Boolean(user),
  });
}

/**
 * Bell badge. Re-checked every time the app returns to the foreground (and on
 * mount); Realtime (useNotificationSync) refreshes it instantly when available.
 */
export function useUnreadCount() {
  const { user } = useAuth();
  return useQuery({
    queryKey: notificationKeys.unread,
    queryFn: fetchUnreadCount,
    enabled: Boolean(user),
    staleTime: 0,
    refetchOnWindowFocus: "always",
  });
}

/**
 * Mount once while signed in: listens for new/changed notifications through
 * Supabase Realtime (the database only sends the recipient their own rows) and
 * refreshes the badge and list. If Realtime is unavailable nothing breaks — the
 * foreground refresh above still keeps the badge correct.
 */
export function useNotificationSync() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  useEffect(() => {
    if (!userId || !isSupabaseConfigured) return;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel(`notifications:${userId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "notifications", filter: `recipient_id=eq.${userId}` },
          () => {
            void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
          },
        )
        .subscribe();
    } catch {
      channel = null; // Realtime not available: foreground refresh still applies
    }
    return () => {
      if (channel) void supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}

function setItems(queryClient: ReturnType<typeof useQueryClient>, update: (item: NotificationItem) => NotificationItem) {
  queryClient.setQueryData<ListCache>(notificationKeys.list, (data) =>
    data ? { ...data, pages: data.pages.map((p) => ({ ...p, items: p.items.map(update) })) } : data,
  );
}

/** Opening an item marks it read at once (badge and dot update immediately); the server is then told. */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (item: NotificationItem) => markNotificationRead(item.key),
    onMutate: (item) => {
      if (!item.unread) return;
      setItems(queryClient, (n) => (n.key === item.key ? { ...n, unread: false } : n));
      queryClient.setQueryData<number>(notificationKeys.unread, (c) => Math.max(0, (c ?? 1) - 1));
    },
    onError: () => void queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: notificationKeys.unread }),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markAllNotificationsRead,
    onMutate: () => {
      setItems(queryClient, (n) => (n.unread ? { ...n, unread: false } : n));
      queryClient.setQueryData<number>(notificationKeys.unread, 0);
    },
    onError: () => void queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: notificationKeys.unread }),
  });
}
