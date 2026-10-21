import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";

import ImpactCard from "@/components/home/impact-card";
import { BellIcon, ChevronRightIcon, SearchIcon } from "@/components/icons";
import PostCard from "@/components/posts/post-card";
import PersonCard from "@/components/social/person-card";
import AppText from "@/components/ui/app-text";
import Avatar from "@/components/ui/avatar";
import Button from "@/components/ui/button";
import Card from "@/components/ui/card";
import { FilterChip } from "@/components/ui/chip";
import EmptyState from "@/components/ui/empty-state";
import GenzLogo from "@/components/ui/genz-logo";
import IconButton from "@/components/ui/icon-button";
import Screen from "@/components/ui/screen";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";
import { Colors, FontFamily, Spacing } from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";
import { impactKeys } from "@/hooks/use-impact";
import { postKeys, useFeaturedPost, useFeed } from "@/hooks/use-posts";
import { profileKeys, useMyProfile, useMyProfileTags, useTagCatalogue } from "@/hooks/use-profile";
import { socialKeys, useSuggestedPeople } from "@/hooks/use-social";
import { avatarPublicUrl } from "@/services/profile";
import type { Post } from "@/types/post";

/**
 * Home (spec FR-06, FR-07, FR-12; prototype HomeScreen): greeting + global
 * actions, This Week's Impact, then the feed of everything the viewer may see
 * (public accounts, accounts they follow, their own posts), newest first,
 * 20 per page with infinite scroll. "Featured Action" and "People to Follow"
 * appear only when real data exists.
 */
export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: profile, isPending, isError, error: profileError, refetch } = useMyProfile();
  const { data: tags } = useMyProfileTags();
  const catalogue = useTagCatalogue();
  const featured = useFeaturedPost();
  const people = useSuggestedPeople();
  const [category, setCategory] = useState<string | null>(null);
  const feed = useFeed(category);
  const [refreshing, setRefreshing] = useState(false);

  const posts = useMemo(() => feed.data?.pages.flatMap((p) => p.posts) ?? [], [feed.data]);

  const onRefresh = async () => {
    if (!user) return;
    setRefreshing(true);
    await Promise.allSettled([
      queryClient.invalidateQueries({ queryKey: profileKeys.detail(user.id) }),
      queryClient.invalidateQueries({ queryKey: impactKeys.mine(user.id) }),
      queryClient.invalidateQueries({ queryKey: postKeys.all }),
      queryClient.invalidateQueries({ queryKey: socialKeys.suggested }),
    ]);
    setRefreshing(false);
  };

  const onEndReached = useCallback(() => {
    if (feed.hasNextPage && !feed.isFetchingNextPage && !feed.isError) void feed.fetchNextPage();
  }, [feed]);

  const missing: string[] = [];
  if (profile && !profile.avatar_path) missing.push("a photo");
  if (profile && !profile.bio) missing.push("a bio");
  if (profile && tags && tags.length === 0) missing.push("tags");

  const header = (
    <View style={styles.headerBlock}>
      {/* Logo + greeting, global actions (FR-06) */}
      <View style={styles.header}>
        <View style={styles.greeting}>
          <GenzLogo size="md" variant="mark" />
          <View style={styles.flex}>
            <AppText style={styles.welcome} color={Colors.text3}>
              {profile ? "Welcome back," : "Welcome back"}
            </AppText>
            {isPending ? (
              <Skeleton width={120} height={18} />
            ) : !profile ? null : (
              <AppText style={styles.name} numberOfLines={1} accessibilityRole="header">
                {profile.display_name}
              </AppText>
            )}
          </View>
        </View>
        <View style={styles.actions}>
          <IconButton icon={<SearchIcon size={18} color={Colors.text3} />} onPress={() => router.push("/search")} accessibilityLabel="Search" />
          <IconButton icon={<BellIcon size={18} color={Colors.text3} />} onPress={() => router.push("/notifications")} accessibilityLabel="Notifications" />
          <Avatar name={profile?.display_name ?? "Your profile"} uri={avatarPublicUrl(profile?.avatar_path)} size={36} onPress={() => router.navigate("/profile")} />
        </View>
      </View>

      {isError ? (
        <Pressable onPress={() => void refetch()} accessibilityRole="button" style={styles.errorBanner}>
          <AppText variant="caption" color={Colors.red}>
            Couldn&apos;t load your profile. {profileError?.message} Tap to retry.
          </AppText>
        </Pressable>
      ) : null}

      <ImpactCard />

      {missing.length > 0 ? (
        <Pressable
          onPress={() => router.push("/settings/edit-profile")}
          accessibilityRole="button"
          accessibilityLabel={`Complete your profile: add ${missing.join(", ")}`}
          style={({ pressed }) => [pressed && styles.pressed]}
        >
          <Card tone="accent" style={styles.completeCard}>
            <View style={styles.flex}>
              <AppText variant="bodyBold">Complete your profile</AppText>
              <AppText variant="caption" color={Colors.text2} style={styles.completeText}>
                Add {formatList(missing)} so people know what you care about.
              </AppText>
            </View>
            <ChevronRightIcon size={18} color={Colors.cyan} />
          </Card>
        </Pressable>
      ) : null}

      {featured.data ? (
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <AppText variant="bodyBold" style={styles.sectionTitle}>
              🔥 Featured Action
            </AppText>
            <Pressable onPress={() => router.push({ pathname: "/post/[id]", params: { id: featured.data!.id } })} accessibilityRole="button">
              <AppText variant="captionSemiBold" color={Colors.cyan}>
                See post →
              </AppText>
            </Pressable>
          </View>
          <PostCard post={featured.data} />
        </View>
      ) : null}

      {people.data && people.data.length > 0 ? (
        <View style={styles.section}>
          <AppText variant="bodyBold" style={styles.sectionTitle}>
            👥 People to Follow
          </AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.people}>
            {people.data.map((person) => (
              <PersonCard key={person.id} person={person} />
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.section}>
        <AppText variant="bodyBold" style={styles.sectionTitle}>
          📋 Action Feed
        </AppText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          <FilterChip label="All" selected={category === null} onPress={() => setCategory(null)} />
          {(catalogue.data ?? []).map((c) => (
            <FilterChip key={c.id} label={c.label} selected={category === c.id} onPress={() => setCategory(c.id)} />
          ))}
        </ScrollView>
      </View>
    </View>
  );

  const empty = feed.isPending ? (
    <View style={styles.skeletons} accessibilityLabel="Loading posts">
      <SkeletonCard />
      <SkeletonCard />
    </View>
  ) : feed.isError ? (
    <EmptyState
      emoji="⚠️"
      title="Couldn't load the feed"
      subtitle={feed.error.message}
      action={<Button label="Try again" variant="secondary" size="md" onPress={() => void feed.refetch()} />}
    />
  ) : category ? (
    <EmptyState emoji="🔍" title="No posts in this category" subtitle="Try a different filter." />
  ) : (
    <EmptyState
      emoji="🌱"
      title="Your feed is empty"
      subtitle="Be the first to post, or follow people to see their posts here."
      action={<Button label="Create a post" variant="action" size="md" onPress={() => router.navigate("/create")} />}
    />
  );

  return (
    <Screen padded={false}>
      <FlatList<Post>
        data={posts}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => <PostCard post={item} />}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={
          feed.isFetchingNextPage ? (
            <ActivityIndicator color={Colors.cyan} style={styles.footer} />
          ) : feed.isFetchNextPageError ? (
            <Button label="Couldn't load more — retry" variant="ghost" size="sm" onPress={() => void feed.fetchNextPage()} style={styles.footer} />
          ) : posts.length > 0 && !feed.hasNextPage ? (
            <AppText variant="caption" color={Colors.text3} align="center" style={styles.footer}>
              You&apos;re all caught up
            </AppText>
          ) : null
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

function Separator() {
  return <View style={{ height: Spacing.lg }} />;
}

function formatList(items: string[]) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: Spacing.xl, paddingBottom: 120 },
  headerBlock: { gap: Spacing.lg, marginBottom: Spacing.lg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: Spacing.lg, gap: Spacing.md },
  greeting: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, flex: 1, minWidth: 0 },
  flex: { flex: 1, minWidth: 0 },
  welcome: { fontFamily: FontFamily.medium, fontSize: 11, lineHeight: 14 },
  name: { fontFamily: FontFamily.displayBlack, fontSize: 17, lineHeight: 22 },
  actions: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  errorBanner: { paddingVertical: Spacing.sm },
  section: { gap: Spacing.sm },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontFamily: FontFamily.displayBold },
  pressed: { opacity: 0.85 },
  completeCard: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  completeText: { marginTop: 2 },
  people: { gap: Spacing.md, paddingRight: Spacing.xl },
  filters: { gap: Spacing.sm, paddingVertical: 2, paddingRight: Spacing.xl },
  skeletons: { gap: Spacing.lg },
  footer: { marginVertical: Spacing.xl },
});
