import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";

import { CommunitiesHeader, CommunityCard } from "@/components/communities/communities-tab";
import CategoryGrid from "@/components/discovery/category-grid";
import { TrendingRankedList } from "@/components/discovery/hashtag-rows";
import ListFooter from "@/components/discovery/list-footer";
import { FireIcon, SearchIcon } from "@/components/icons";
import PostCard from "@/components/posts/post-card";
import PersonRow from "@/components/social/person-row";
import AppText from "@/components/ui/app-text";
import Button from "@/components/ui/button";
import Card from "@/components/ui/card";
import EmptyState from "@/components/ui/empty-state";
import Screen from "@/components/ui/screen";
import SegmentedTabs from "@/components/ui/segmented-tabs";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";
import { CategoryColors, Colors, FontFamily, Radius, Spacing, type CategoryId } from "@/constants/theme";
import { discoveryKeys } from "@/hooks/discovery-keys";
import { communityKeys, useCommunities } from "@/hooks/use-communities";
import { usePeopleSuggestions, useTopPostsThisWeek, useTrendingTags } from "@/hooks/use-discovery";
import { postKeys, useFeed } from "@/hooks/use-posts";
import { socialKeys } from "@/hooks/use-social";
import type { CommunitySummary } from "@/types/community";
import type { PeopleSuggestion } from "@/types/discovery";
import type { Post } from "@/types/post";

type Tab = "discover" | "trending" | "people" | "communities";
const TABS = [
  { value: "discover", label: "Discover" },
  { value: "trending", label: "Trending" },
  { value: "people", label: "People" },
  { value: "communities", label: "Communities" },
] as const;
const isTab = (v: unknown): v is Tab => v === "discover" || v === "trending" || v === "people" || v === "communities";

type Item = { kind: "post"; post: Post } | { kind: "person"; person: PeopleSuggestion } | { kind: "community"; community: CommunitySummary };

/**
 * Explore (spec FR-25; prototype ExploreScreen):
 *  • Discover — the 8 causes; tapping one lists its posts (newest first, paginated).
 *  • Trending — trending hashtags (last 7 days, decision D39) and Top Actions This Week.
 *  • People   — suggested changemakers (shared causes, then network, then
 *               popularity, decision D40) with Follow buttons, paginated.
 *  • Communities — create one, answer invitations, your communities, and
 *               Discover (every community; identity is public, D47). Phase 6.
 * The search bar opens the full Search screen. Everything is filtered by the
 * database to what the viewer may see (private accounts, blocks).
 * Home's "See all" links open a tab directly: /explore?tab=trending|people&at=<time>.
 */
export default function ExploreScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ tab?: string; at?: string }>();
  const [tab, setTab] = useState<Tab>(isTab(params.tab) ? params.tab : "discover");
  const [category, setCategory] = useState<CategoryId | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // A Home "See all" link can switch tabs while Explore is already mounted
  // (`at` changes on every tap, so the same link works twice). Adjusted during
  // render when the link changes (React's pattern, no effect).
  const linkKey = `${params.tab ?? ""}|${params.at ?? ""}`;
  const [seenLink, setSeenLink] = useState(linkKey);
  if (seenLink !== linkKey) {
    setSeenLink(linkKey);
    if (isTab(params.tab)) setTab(params.tab);
  }

  const categoryFeed = useFeed(category);
  const trending = useTrendingTags(10);
  const top = useTopPostsThisWeek();
  const people = usePeopleSuggestions();
  const communities = useCommunities("discover");

  // Which paginated list the tab shows (the category feed only once a cause is picked).
  const list =
    tab === "discover" ? (category ? categoryFeed : null) : tab === "trending" ? top : tab === "communities" ? communities : people;

  const items: Item[] = useMemo(() => {
    if (tab === "people") return (people.data?.pages.flatMap((p) => p.people) ?? []).map((person) => ({ kind: "person", person }));
    if (tab === "communities")
      return (communities.data?.pages.flatMap((p) => p.communities) ?? []).map((community) => ({ kind: "community", community }));
    const source = tab === "trending" ? top.data : category ? categoryFeed.data : undefined;
    return (source?.pages.flatMap((p) => p.posts) ?? []).map((post) => ({ kind: "post", post }));
  }, [tab, category, people.data, top.data, categoryFeed.data, communities.data]);

  const onEndReached = useCallback(() => {
    if (list && list.hasNextPage && !list.isFetchingNextPage && !list.isError) void list.fetchNextPage();
  }, [list]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.allSettled(
      tab === "people"
        ? [queryClient.invalidateQueries({ queryKey: socialKeys.people })]
        : tab === "communities"
          ? [queryClient.invalidateQueries({ queryKey: communityKeys.all })]
        : tab === "trending"
          ? [queryClient.invalidateQueries({ queryKey: discoveryKeys.all }), queryClient.invalidateQueries({ queryKey: postKeys.topWeek })]
          : [queryClient.invalidateQueries({ queryKey: postKeys.feed(category) })],
    );
    setRefreshing(false);
  };

  // ------------------------------------------------------------ header
  let tabHeader: ReactNode = null;
  if (tab === "discover") {
    tabHeader = (
      <View style={styles.block}>
        <SectionTitle>Browse by Category</SectionTitle>
        <CategoryGrid selected={category} onSelect={setCategory} />
        {category ? (
          <View style={[styles.sectionHead, styles.blockTop]}>
            <SectionTitle>{CategoryColors[category].label} Actions</SectionTitle>
            <Pressable onPress={() => setCategory(null)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear category">
              <AppText variant="captionSemiBold" color={Colors.cyan}>
                Clear
              </AppText>
            </Pressable>
          </View>
        ) : (
          <AppText variant="caption" color={Colors.text3} align="center" style={styles.blockTop}>
            Pick a cause to see its latest posts.
          </AppText>
        )}
      </View>
    );
  } else if (tab === "trending") {
    tabHeader = (
      <View style={styles.block}>
        <View style={styles.titleRow}>
          <FireIcon size={16} color={CategoryColors.housing.text} />
          <SectionTitle>Trending Tags</SectionTitle>
        </View>
        {trending.isPending ? (
          <View style={styles.skeletons}>
            <Skeleton height={64} radius={Radius.lg} />
            <Skeleton height={64} radius={Radius.lg} />
            <Skeleton height={64} radius={Radius.lg} />
          </View>
        ) : trending.isError ? (
          <Pressable onPress={() => void trending.refetch()} accessibilityRole="button">
            <AppText variant="caption" color={Colors.red}>
              Couldn&apos;t load trending tags. {trending.error.message} Tap to retry.
            </AppText>
          </Pressable>
        ) : trending.data.length === 0 ? (
          <Card>
            <AppText variant="bodySemiBold">No trending tags yet</AppText>
            <AppText variant="caption" color={Colors.text2} style={styles.cardText}>
              Tags used in posts from the last 7 days show up here. Add a #hashtag to your next post!
            </AppText>
          </Card>
        ) : (
          <TrendingRankedList tags={trending.data} />
        )}
        <SectionTitle style={styles.blockTop}>Top Actions This Week</SectionTitle>
      </View>
    );
  } else if (tab === "communities") {
    tabHeader = <CommunitiesHeader />;
  } else {
    tabHeader = (
      <View style={styles.block}>
        <SectionTitle>Suggested Changemakers</SectionTitle>
        <AppText variant="caption" color={Colors.text3}>
          People who share your causes come first, then people your network follows.
        </AppText>
      </View>
    );
  }

  const header = (
    <View style={styles.header}>
      <AppText variant="title" accessibilityRole="header" style={styles.screenTitle}>
        Explore
      </AppText>
      <Pressable
        onPress={() => router.push("/search")}
        accessibilityRole="button"
        accessibilityLabel="Search actions, causes, people"
        style={({ pressed }) => [styles.searchBar, pressed && styles.pressed]}
      >
        <SearchIcon size={18} color={Colors.text2} />
        <AppText variant="body" color={Colors.text3} numberOfLines={1}>
          Search actions, causes, people...
        </AppText>
      </Pressable>
      <SegmentedTabs options={TABS} value={tab} onChange={setTab} compact />
      {tabHeader}
    </View>
  );

  // ------------------------------------------------------------ empty states
  let empty: ReactNode = null;
  if (list) {
    if (list.isPending) {
      empty =
        tab === "people" ? (
          <View style={styles.skeletons} accessibilityLabel="Loading people">
            <Skeleton height={56} />
            <Skeleton height={56} />
            <Skeleton height={56} />
          </View>
        ) : (
          <View style={styles.skeletons} accessibilityLabel="Loading posts">
            <SkeletonCard />
          </View>
        );
    } else if (list.isError) {
      empty = (
        <EmptyState
          emoji="⚠️"
          title={tab === "people" ? "Couldn't load suggestions" : tab === "communities" ? "Couldn't load communities" : "Couldn't load posts"}
          subtitle={list.error?.message}
          action={<Button label="Try again" variant="secondary" size="md" onPress={() => void list.refetch()} />}
        />
      );
    } else if (tab === "people") {
      empty = <EmptyState emoji="👥" title="No suggestions right now" subtitle="You're following everyone we'd suggest. Check back as more people join." />;
    } else if (tab === "communities") {
      empty = <EmptyState emoji="🫂" title="No communities yet" subtitle="Start the first one — tap Create a community above." />;
    } else if (tab === "trending") {
      empty = <EmptyState emoji="📈" title="No posts this week yet" subtitle="The most liked and discussed posts from the last 7 days appear here." />;
    } else {
      empty = <EmptyState emoji="🔍" title="No posts in this cause yet" subtitle="Be the first to post about it." />;
    }
  }

  const renderItem = useCallback(
    ({ item }: { item: Item }) =>
      item.kind === "community" ? (
        <CommunityCard community={item.community} />
      ) : item.kind === "person" ? (
        <PersonRow
          person={item.person}
          relationship="none"
          note={
            item.person.shared_tag_count > 0
              ? `${item.person.shared_tag_count} ${item.person.shared_tag_count === 1 ? "cause" : "causes"} in common`
              : undefined
          }
        />
      ) : (
        <View style={styles.postItem}>
          <PostCard post={item.post} />
        </View>
      ),
    [],
  );

  return (
    <Screen padded={false}>
      <FlatList<Item>
        data={items}
        keyExtractor={(i) => (i.kind === "person" ? `p:${i.person.id}` : i.kind === "community" ? `c:${i.community.id}` : `o:${i.post.id}`)}
        renderItem={renderItem}
        ItemSeparatorComponent={tab === "people" ? RowDivider : undefined}
        ListHeaderComponent={header}
        ListEmptyComponent={empty ? <>{empty}</> : undefined}
        ListFooterComponent={
          list ? (
            <ListFooter
              isFetchingNextPage={list.isFetchingNextPage}
              isFetchNextPageError={list.isFetchNextPageError}
              hasNextPage={Boolean(list.hasNextPage)}
              itemCount={items.length}
              onRetry={() => void list.fetchNextPage()}
              endLabel={tab === "people" || tab === "communities" ? undefined : "You're all caught up"}
            />
          ) : undefined
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.cyan} colors={[Colors.cyanDim]} />}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />
    </Screen>
  );
}

function SectionTitle({ children, style }: { children: ReactNode; style?: object }) {
  return (
    <AppText variant="bodySemiBold" color={Colors.text2} style={[styles.sectionTitle, style]} accessibilityRole="header">
      {children}
    </AppText>
  );
}

function RowDivider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: Spacing.xl, paddingBottom: 120 },
  header: { gap: Spacing.lg, paddingTop: Spacing.lg, marginBottom: Spacing.lg },
  screenTitle: { fontFamily: FontFamily.displayBlack },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    minHeight: 48,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: Colors.elevated,
    borderWidth: 1,
    borderColor: Colors.hairline,
  },
  pressed: { opacity: 0.85 },
  block: { gap: Spacing.md, marginTop: Spacing.xs },
  blockTop: { marginTop: Spacing.md },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  sectionTitle: { fontFamily: FontFamily.semiBold },
  cardText: { marginTop: 4 },
  skeletons: { gap: Spacing.sm },
  postItem: { marginBottom: Spacing.lg },
  divider: { height: 1, backgroundColor: Colors.divider },
});
