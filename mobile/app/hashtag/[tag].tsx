import { useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";

import { postsLabel } from "@/components/discovery/hashtag-rows";
import ListFooter from "@/components/discovery/list-footer";
import PostCard from "@/components/posts/post-card";
import AppText from "@/components/ui/app-text";
import Button from "@/components/ui/button";
import EmptyState from "@/components/ui/empty-state";
import Screen from "@/components/ui/screen";
import ScreenHeader from "@/components/ui/screen-header";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";
import { Colors, Spacing } from "@/constants/theme";
import { useHashtag, useHashtagPosts } from "@/hooks/use-discovery";
import { normaliseTag } from "@/services/discovery";
import type { Post } from "@/types/post";

/**
 * Hashtag feed (spec FR-13): every post with this tag that the viewer may see,
 * newest first, 20 per page. Opened by tapping a #tag anywhere (post text,
 * Trending, search). Private accounts' posts (unless followed) and blocked
 * people never appear — the count in the header counts the same posts.
 */
export default function HashtagScreen() {
  const params = useLocalSearchParams<{ tag: string }>();
  const tag = normaliseTag(String(params.tag ?? ""));
  const header = useHashtag(tag);
  const feed = useHashtagPosts(tag);
  const [refreshing, setRefreshing] = useState(false);
  const posts = useMemo(() => feed.data?.pages.flatMap((p) => p.posts) ?? [], [feed.data]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.allSettled([header.refetch(), feed.refetch()]);
    setRefreshing(false);
  };
  const onEndReached = useCallback(() => {
    if (feed.hasNextPage && !feed.isFetchingNextPage && !feed.isError) void feed.fetchNextPage();
  }, [feed]);

  if (!tag) {
    return (
      <Screen header={<ScreenHeader title="Hashtag" back />} edges={["top", "bottom"]}>
        <EmptyState emoji="#️⃣" title="Hashtag not found" subtitle="Tap a #tag in a post to see everything tagged with it." />
      </Screen>
    );
  }

  const summary = header.isPending ? (
    <Skeleton width={80} height={14} />
  ) : (
    <AppText variant="caption" color={Colors.text2} accessibilityLiveRegion="polite">
      {header.data ? postsLabel(header.data.post_count) : "No posts yet"}
    </AppText>
  );

  return (
    <Screen padded={false} header={<ScreenHeader title={`#${tag}`} back />} edges={["top", "bottom"]}>
      <FlatList<Post>
        data={posts}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => <PostCard post={item} />}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={<View style={styles.summary}>{summary}</View>}
        ListEmptyComponent={
          feed.isPending ? (
            <View style={styles.skeletons} accessibilityLabel="Loading posts">
              <SkeletonCard />
              <SkeletonCard />
            </View>
          ) : feed.isError ? (
            <EmptyState
              emoji="⚠️"
              title="Couldn't load these posts"
              subtitle={feed.error.message}
              action={<Button label="Try again" variant="secondary" size="md" onPress={() => void feed.refetch()} />}
            />
          ) : (
            <EmptyState emoji="#️⃣" title={`No posts for #${tag} yet`} subtitle="Use this tag in a post and it will show up here." />
          )
        }
        ListFooterComponent={
          <ListFooter
            isFetchingNextPage={feed.isFetchingNextPage}
            isFetchNextPageError={feed.isFetchNextPageError}
            hasNextPage={Boolean(feed.hasNextPage)}
            itemCount={posts.length}
            onRetry={() => void feed.fetchNextPage()}
            endLabel="That's every post with this tag"
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
  list: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxxl },
  summary: { marginBottom: Spacing.lg },
  skeletons: { gap: Spacing.lg },
});
