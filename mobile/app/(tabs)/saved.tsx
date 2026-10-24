import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";

import ListFooter from "@/components/discovery/list-footer";
import PostCard from "@/components/posts/post-card";
import AppText from "@/components/ui/app-text";
import Button from "@/components/ui/button";
import EmptyState from "@/components/ui/empty-state";
import Screen from "@/components/ui/screen";
import SegmentedTabs from "@/components/ui/segmented-tabs";
import { SkeletonCard } from "@/components/ui/skeleton";
import { Colors, FontFamily, Spacing } from "@/constants/theme";
import { postKeys, useMyPostList } from "@/hooks/use-posts";
import type { MyPostList } from "@/types/notification";
import type { Post } from "@/types/post";

const TABS = [
  { value: "saved", label: "Saved" },
  { value: "liked", label: "Liked" },
] as const;

/**
 * Saved tab (spec FR-19; prototype ActivityScreen): your saved posts and,
 * separately, the posts you liked — most recently saved/liked first, 20 per
 * page. Unsaving (or unliking) a post here removes it at once. Posts that were
 * deleted or that you can no longer see drop out automatically (database).
 */
export default function SavedScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<MyPostList>("saved");
  const list = useMyPostList(tab);
  const [refreshing, setRefreshing] = useState(false);
  const posts = useMemo(() => list.data?.pages.flatMap((p) => p.posts) ?? [], [list.data]);

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: postKeys.mine(tab) });
    setRefreshing(false);
  };
  const onEndReached = useCallback(() => {
    if (list.hasNextPage && !list.isFetchingNextPage && !list.isError) void list.fetchNextPage();
  }, [list]);

  const header = (
    <View style={styles.header}>
      <AppText variant="title" accessibilityRole="header" style={styles.title}>
        Activity
      </AppText>
      <SegmentedTabs options={TABS} value={tab} onChange={setTab} />
    </View>
  );

  const empty = list.isPending ? (
    <View style={styles.skeletons} accessibilityLabel="Loading posts">
      <SkeletonCard />
      <SkeletonCard />
    </View>
  ) : list.isError ? (
    <EmptyState
      emoji="⚠️"
      title="Couldn't load your posts"
      subtitle={list.error.message}
      action={<Button label="Try again" variant="secondary" size="md" onPress={() => void list.refetch()} />}
    />
  ) : tab === "saved" ? (
    <EmptyState
      emoji="🔖"
      title="Nothing saved yet"
      subtitle="Tap the bookmark icon on any post to save it for later."
      action={<Button label="Explore actions" variant="action" size="md" onPress={() => router.navigate("/explore")} />}
    />
  ) : (
    <EmptyState
      emoji="❤️"
      title="No liked posts yet"
      subtitle="Tap the heart on posts you care about to find them here."
      action={<Button label="Explore actions" variant="action" size="md" onPress={() => router.navigate("/explore")} />}
    />
  );

  return (
    <Screen padded={false}>
      <FlatList<Post>
        key={tab}
        data={posts}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => <PostCard post={item} />}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={
          <ListFooter
            isFetchingNextPage={list.isFetchingNextPage}
            isFetchNextPageError={list.isFetchNextPageError}
            hasNextPage={Boolean(list.hasNextPage)}
            itemCount={posts.length}
            onRetry={() => void list.fetchNextPage()}
            endLabel={tab === "saved" ? "That's everything you saved" : "That's everything you liked"}
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

function Separator() {
  return <View style={{ height: Spacing.lg }} />;
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: Spacing.xl, paddingBottom: 120, flexGrow: 1 },
  header: { gap: Spacing.lg, paddingTop: Spacing.lg, marginBottom: Spacing.lg },
  title: { fontFamily: FontFamily.displayBlack },
  skeletons: { gap: Spacing.lg },
});
