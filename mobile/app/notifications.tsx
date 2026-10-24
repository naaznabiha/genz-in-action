import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";

import ListFooter from "@/components/discovery/list-footer";
import AppText from "@/components/ui/app-text";
import Avatar from "@/components/ui/avatar";
import Button from "@/components/ui/button";
import EmptyState from "@/components/ui/empty-state";
import Screen from "@/components/ui/screen";
import ScreenHeader from "@/components/ui/screen-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { Colors, FontFamily, Spacing } from "@/constants/theme";
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications, useUnreadCount } from "@/hooks/use-notifications";
import { describeNotification } from "@/lib/notification-text";
import { relativeTime } from "@/lib/time";
import { avatarPublicUrl } from "@/services/profile";
import type { NotificationItem } from "@/types/notification";

const TYPE_ICON: Record<string, string> = {
  like: "❤️",
  comment: "💬",
  follow: "👤",
  follow_request: "🔒",
  follow_accepted: "✅",
};

type Row = { kind: "heading"; label: string } | { kind: "item"; item: NotificationItem };

/**
 * Notifications (spec FR-15; prototype NotificationsScreen), opened from the
 * Home bell. Newest first, 30 per page. Unread items have a tint and a dot and
 * sit under "New (n)". Tapping one marks it read and opens what it is about;
 * "Mark all read" clears every unread item (stored in the database, so it
 * survives a restart). Likes on the same post are one item (D43).
 */
export default function NotificationsScreen() {
  const router = useRouter();
  const toast = useToast();
  const list = useNotifications();
  const unread = useUnreadCount();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const [refreshing, setRefreshing] = useState(false);

  const items = useMemo(() => list.data?.pages.flatMap((p) => p.items) ?? [], [list.data]);
  const unreadCount = unread.data ?? items.filter((i) => i.unread).length;

  const rows: Row[] = useMemo(() => {
    const fresh = items.filter((i) => i.unread);
    const earlier = items.filter((i) => !i.unread);
    const out: Row[] = [];
    if (fresh.length > 0) {
      out.push({ kind: "heading", label: `New (${unreadCount})` });
      out.push(...fresh.map((item) => ({ kind: "item" as const, item })));
    }
    if (earlier.length > 0) {
      if (fresh.length > 0) out.push({ kind: "heading", label: "Earlier" });
      out.push(...earlier.map((item) => ({ kind: "item" as const, item })));
    }
    return out;
  }, [items, unreadCount]);

  const open = useCallback(
    (n: NotificationItem) => {
      if (n.unread) markRead.mutate(n, { onError: () => toast.show("Couldn't mark it as read.", "error") });
      if ((n.type === "like" || n.type === "comment") && n.post_id) {
        router.push({ pathname: "/post/[id]", params: { id: n.post_id } });
      } else if (n.type === "follow_request") {
        router.push("/settings/follow-requests");
      } else {
        router.push({ pathname: "/user/[id]", params: { id: n.actor_id } });
      }
    },
    [markRead, router, toast],
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.allSettled([list.refetch(), unread.refetch()]);
    setRefreshing(false);
  };
  const onEndReached = useCallback(() => {
    if (list.hasNextPage && !list.isFetchingNextPage && !list.isError) void list.fetchNextPage();
  }, [list]);

  const header = (
    <ScreenHeader
      title="Notifications"
      back
      right={
        unreadCount > 0 ? (
          <Pressable
            onPress={() => markAll.mutate(undefined, { onError: () => toast.show("Couldn't mark all as read. Try again.", "error") })}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={`Mark all ${unreadCount} as read`}
          >
            <AppText variant="captionSemiBold" color={Colors.cyan}>
              Mark all read
            </AppText>
          </Pressable>
        ) : undefined
      }
    />
  );

  return (
    <Screen padded={false} header={header} edges={["top", "bottom"]}>
      <FlatList<Row>
        data={rows}
        keyExtractor={(r) => (r.kind === "heading" ? `h:${r.label}` : r.item.key)}
        renderItem={({ item: r }) =>
          r.kind === "heading" ? (
            <AppText style={styles.heading} color={Colors.text2} accessibilityRole="header">
              {r.label}
            </AppText>
          ) : (
            <NotificationRow item={r.item} onPress={open} />
          )
        }
        ListEmptyComponent={
          list.isPending ? (
            <View style={styles.skeletons} accessibilityLabel="Loading notifications">
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={styles.skeletonRow}>
                  <Skeleton width={44} height={44} radius={22} />
                  <View style={styles.flex}>
                    <Skeleton height={14} />
                    <Skeleton width={80} height={10} />
                  </View>
                </View>
              ))}
            </View>
          ) : list.isError ? (
            <EmptyState
              emoji="⚠️"
              title="Couldn't load notifications"
              subtitle={list.error.message}
              action={<Button label="Try again" variant="secondary" size="md" onPress={() => void list.refetch()} />}
            />
          ) : (
            <EmptyState emoji="🔔" title="All caught up!" subtitle="You have no notifications right now. Likes, comments and follows show up here." />
          )
        }
        ListFooterComponent={
          <ListFooter
            isFetchingNextPage={list.isFetchingNextPage}
            isFetchNextPageError={list.isFetchNextPageError}
            hasNextPage={Boolean(list.hasNextPage)}
            itemCount={items.length}
            onRetry={() => void list.fetchNextPage()}
          />
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.cyan} colors={[Colors.cyanDim]} />}
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}

function NotificationRow({ item, onPress }: { item: NotificationItem; onPress: (n: NotificationItem) => void }) {
  const { lead, rest } = describeNotification(item);
  return (
    <Pressable
      onPress={() => onPress(item)}
      accessibilityRole="button"
      accessibilityLabel={`${item.unread ? "Unread. " : ""}${lead}${rest}, ${relativeTime(item.created_at)}`}
      style={({ pressed }) => [styles.row, item.unread && styles.unreadRow, pressed && styles.pressed]}
    >
      <View>
        <Avatar name={item.actor_display_name} uri={avatarPublicUrl(item.actor_avatar_path)} size={44} />
        <View style={styles.typeBubble}>
          <AppText style={styles.typeIcon} accessible={false}>
            {TYPE_ICON[item.type] ?? "🔔"}
          </AppText>
        </View>
      </View>
      <View style={styles.flex}>
        <AppText variant="body" color={item.unread ? Colors.text1 : Colors.text2} numberOfLines={3}>
          <AppText variant="bodySemiBold" color={item.unread ? Colors.text1 : Colors.text2}>
            {lead}
          </AppText>
          {rest}
        </AppText>
        <AppText variant="caption" color={Colors.text3} style={styles.time}>
          {relativeTime(item.created_at)}
        </AppText>
      </View>
      {item.unread ? <View style={styles.dot} accessible={false} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: Spacing.xxxl, flexGrow: 1 },
  flex: { flex: 1, minWidth: 0, gap: 4 },
  heading: {
    fontFamily: FontFamily.semiBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  row: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.lg, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.lg },
  unreadRow: { backgroundColor: "rgba(0,191,191,0.07)" },
  pressed: { opacity: 0.8 },
  typeBubble: {
    position: "absolute",
    right: -3,
    bottom: -3,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  typeIcon: { fontSize: 10, lineHeight: 13 },
  time: { marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.cyanDim, marginTop: 8 },
  skeletons: { gap: Spacing.lg, padding: Spacing.xl },
  skeletonRow: { flexDirection: "row", gap: Spacing.lg, alignItems: "center" },
});
