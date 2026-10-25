import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";

import ContentCard from "@/components/communities/content-card";
import ListFooter from "@/components/discovery/list-footer";
import { PlusIcon } from "@/components/icons";
import PostCard from "@/components/posts/post-card";
import AppText from "@/components/ui/app-text";
import Button from "@/components/ui/button";
import { FilterChip } from "@/components/ui/chip";
import EmptyState from "@/components/ui/empty-state";
import Screen from "@/components/ui/screen";
import ScreenHeader from "@/components/ui/screen-header";
import { SkeletonCard } from "@/components/ui/skeleton";
import { Colors, Spacing } from "@/constants/theme";
import { communityKeys, useCommunity, useCommunityFeed } from "@/hooks/use-communities";
import type { FeedItem } from "@/services/communities";
import type { FeedFilter } from "@/types/community";

const FILTERS: { value: FeedFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "posts", label: "Posts" },
  { value: "photos", label: "Photos" },
  { value: "documents", label: "Documents" },
  { value: "text", label: "Text" },
];

/**
 * Community content (approved board "Content"): lasting guides, photos and
 * documents members add, plus posts shared to the community ("Posts"
 * filter). Content stays after its author leaves (shown as "no longer a
 * member"). Members add content with the + button.
 */
export default function CommunityContentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const community = useCommunity(id);
  const c = community.data;
  const [filter, setFilter] = useState<FeedFilter>("all");
  const [refreshing, setRefreshing] = useState(false);
  const feed = useCommunityFeed(id, filter, Boolean(c?.can_read));
  const items = useMemo(() => feed.data?.pages.flatMap((p) => p.items) ?? [], [feed.data]);

  const onRefresh = async () => {
    setRefreshing(true);
    await qc.invalidateQueries({ queryKey: communityKeys.feed(id, filter) });
    setRefreshing(false);
  };

  const renderItem = useCallback(
    ({ item }: { item: FeedItem }) => <View style={styles.item}>{item.kind === "post" ? <PostCard post={item.post} /> : <ContentCard item={item.item} />}</View>,
    [],
  );

  if (c && !c.can_read) {
    return (
      <Screen header={<ScreenHeader back title="Content" />} edges={["top", "bottom"]}>
        <EmptyState emoji="🔒" title="Members only" subtitle="This community's content is visible to its members only." />
      </Screen>
    );
  }

  return (
    <Screen padded={false} header={<ScreenHeader back title={c ? `${c.name} · Content` : "Content"} />} edges={["top", "bottom"]}>
      <FlatList<FeedItem>
        data={items}
        keyExtractor={(i) => (i.kind === "post" ? `p:${i.post.id}` : `c:${i.item.id}`)}
        renderItem={renderItem}
        ListHeaderComponent={
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            {FILTERS.map((f) => (
              <FilterChip key={f.value} label={f.label} selected={filter === f.value} onPress={() => setFilter(f.value)} />
            ))}
          </ScrollView>
        }
        ListEmptyComponent={
          feed.isPending || community.isPending ? (
            <SkeletonCard />
          ) : feed.isError ? (
            <EmptyState emoji="⚠️" title="Couldn't load content" subtitle={feed.error.message} action={<Button label="Try again" variant="secondary" size="md" onPress={() => void feed.refetch()} />} />
          ) : (
            <EmptyState
              emoji="📚"
              title={filter === "all" ? "No content yet" : `No ${FILTERS.find((f) => f.value === filter)?.label.toLowerCase()} yet`}
              subtitle={c?.my_role ? "Add a guide, photo or document for the community — it stays even if you leave." : "Members share guides, photos and documents here."}
            />
          )
        }
        ListFooterComponent={
          <ListFooter
            isFetchingNextPage={feed.isFetchingNextPage}
            isFetchNextPageError={feed.isFetchNextPageError}
            hasNextPage={Boolean(feed.hasNextPage)}
            itemCount={items.length}
            onRetry={() => void feed.fetchNextPage()}
          />
        }
        onEndReached={() => {
          if (feed.hasNextPage && !feed.isFetchingNextPage && !feed.isError) void feed.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.cyan} colors={[Colors.cyanDim]} />}
        showsVerticalScrollIndicator={false}
      />
      {c?.my_role ? (
        <Pressable
          onPress={() => router.push(`/community/${id}/add-content` as Href)}
          accessibilityRole="button"
          accessibilityLabel="Add content"
          style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85 }]}
        >
          <PlusIcon size={20} color={Colors.bg} />
          <AppText variant="bodyBold" color={Colors.bg}>
            Add content
          </AppText>
        </Pressable>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: Spacing.xl, paddingBottom: 120 },
  filters: { gap: Spacing.sm, paddingBottom: Spacing.lg },
  item: { marginBottom: Spacing.md },
  fab: {
    position: "absolute",
    right: Spacing.xl,
    bottom: Spacing.xxl,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: 999,
    backgroundColor: Colors.cyan,
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
});
