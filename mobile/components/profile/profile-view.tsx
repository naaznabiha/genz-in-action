import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from "react-native";

import { CalendarIcon, DotsIcon, EditIcon, MapPinIcon, SettingsIcon, ShieldIcon, TrophyIcon } from "@/components/icons";
import PostCard from "@/components/posts/post-card";
import TagChip from "@/components/profile/tag-chip";
import FollowButton from "@/components/social/follow-button";
import AppText from "@/components/ui/app-text";
import Avatar from "@/components/ui/avatar";
import BottomSheet from "@/components/ui/bottom-sheet";
import Button from "@/components/ui/button";
import Card from "@/components/ui/card";
import EmptyState from "@/components/ui/empty-state";
import IconButton from "@/components/ui/icon-button";
import Screen from "@/components/ui/screen";
import ScreenHeader from "@/components/ui/screen-header";
import SegmentedTabs from "@/components/ui/segmented-tabs";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { Colors, FontFamily, Radius, Spacing } from "@/constants/theme";
import { impactKeys, useMyImpactSummary } from "@/hooks/use-impact";
import { postKeys, useUserPosts } from "@/hooks/use-posts";
import { profileKeys, useMyProfileTags } from "@/hooks/use-profile";
import { socialKeys, useBlockToggle, useProfileSummary, useUserTags } from "@/hooks/use-social";
import { formatCount } from "@/lib/time";
import { avatarPublicUrl, fetchEarnedBadges } from "@/services/profile";
import type { ImpactSummary } from "@/types/impact";
import type { Post } from "@/types/post";

type Tab = "actions" | "about";

function formatJoined(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

/**
 * "Impact" stat. Points only when an approved formula produced them (own
 * profile). With no formula: 0 recorded actions honestly means 0; otherwise "—"
 * (recorded but not scored) rather than an invented number.
 */
function impactLabel(totalActions: number, own: ImpactSummary | undefined) {
  if (own?.formula_status === "approved" && own.impact_points !== null) return formatCount(own.impact_points);
  return totalActions === 0 ? "0" : "—";
}

type ProfileViewProps = { userId: string; isOwn: boolean };

/**
 * Profile screen for yourself (Profile tab) and for others (/user/[id]).
 * Spec FR-10, FR-11, FR-16, FR-17, FR-20; prototype ProfileScreen.
 * Private accounts: non-followers see name, photo and bio but not posts.
 * Blocked: the blocker sees an Unblock state; the blocked person sees "not found".
 */
export default function ProfileView({ userId, isOwn }: ProfileViewProps) {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("actions");
  const [refreshing, setRefreshing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);

  const summary = useProfileSummary(userId);
  const s = summary.data;
  const visible = Boolean(s && s.relationship !== "blocked_by_me");
  const myTags = useMyProfileTags();
  const otherTags = useUserTags(userId, !isOwn && visible);
  const tags = isOwn ? myTags.data : otherTags.data;
  const ownImpact = useMyImpactSummary();
  const badges = useQuery({
    queryKey: ["profiles", userId, "badges"],
    queryFn: () => fetchEarnedBadges(userId),
    enabled: visible && tab === "about",
  });
  const postsQuery = useUserPosts(userId, Boolean(s?.can_view_content));
  const posts = useMemo(() => postsQuery.data?.pages.flatMap((p) => p.posts) ?? [], [postsQuery.data]);
  const blockToggle = useBlockToggle();

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.allSettled([
      queryClient.invalidateQueries({ queryKey: socialKeys.summary(userId) }),
      queryClient.invalidateQueries({ queryKey: postKeys.user(userId) }),
      queryClient.invalidateQueries({ queryKey: socialKeys.tags(userId) }),
      queryClient.invalidateQueries({ queryKey: profileKeys.all }),
      isOwn ? queryClient.invalidateQueries({ queryKey: impactKeys.mine(userId) }) : Promise.resolve(),
    ]);
    setRefreshing(false);
  };

  const onEndReached = useCallback(() => {
    if (postsQuery.hasNextPage && !postsQuery.isFetchingNextPage) void postsQuery.fetchNextPage();
  }, [postsQuery]);

  const doBlock = (block: boolean) =>
    blockToggle.mutate(
      { userId, block },
      {
        onSuccess: () => {
          setConfirmBlock(false);
          setMenuOpen(false);
          toast.show(block ? `@${s?.username} blocked` : `@${s?.username} unblocked`, "success");
        },
        onError: (e) => toast.show(e instanceof Error ? e.message : "Something went wrong.", "error"),
      },
    );

  const topBar = isOwn ? (
    <View style={styles.topBar}>
      <AppText variant="title" accessibilityRole="header">
        Profile
      </AppText>
      <View style={styles.topActions}>
        <IconButton icon={<EditIcon size={17} color={Colors.text2} />} onPress={() => router.push("/settings/edit-profile")} accessibilityLabel="Edit profile" />
        <IconButton icon={<SettingsIcon size={17} color={Colors.text2} />} onPress={() => router.push("/settings")} accessibilityLabel="Settings" />
      </View>
    </View>
  ) : (
    <ScreenHeader
      back
      right={s ? <IconButton icon={<DotsIcon size={18} color={Colors.text1} />} onPress={() => setMenuOpen(true)} accessibilityLabel="Profile options" /> : undefined}
    />
  );

  // ----- loading / not found -----
  if (summary.isPending) {
    return (
      <Screen header={isOwn ? undefined : topBar} edges={isOwn ? ["top"] : ["top", "bottom"]}>
        {isOwn ? topBar : null}
        <View style={styles.identity} accessibilityLabel="Loading profile">
          <Skeleton width={80} height={80} radius={40} />
          <View style={[styles.flex, styles.gapSm]}>
            <Skeleton width="70%" height={20} />
            <Skeleton width="40%" height={14} />
          </View>
        </View>
        <Skeleton height={60} radius={Radius.lg} />
      </Screen>
    );
  }
  if (summary.isError || !s) {
    return (
      <Screen header={isOwn ? undefined : topBar} edges={isOwn ? ["top"] : ["top", "bottom"]}>
        {isOwn ? topBar : null}
        <EmptyState
          emoji={summary.isError ? "⚠️" : "🔍"}
          title={summary.isError ? "Couldn't load this profile" : "This account isn't available"}
          subtitle={summary.isError ? summary.error.message : "It may not exist anymore."}
          action={summary.isError ? <Button label="Try again" onPress={() => void summary.refetch()} variant="secondary" size="md" /> : undefined}
        />
      </Screen>
    );
  }

  const blockedByMe = s.relationship === "blocked_by_me";
  const stats = [
    { label: "Actions", value: formatCount(s.total_actions) },
    { label: "Followers", value: formatCount(s.follower_count) },
    { label: "Following", value: formatCount(s.following_count) },
    { label: "Impact", value: impactLabel(s.total_actions, isOwn ? ownImpact.data : undefined) },
  ];

  const header = (
    <View style={styles.headerBlock}>
      {isOwn ? topBar : null}

      <View style={styles.identity}>
        <Avatar name={s.display_name} uri={avatarPublicUrl(s.avatar_path)} size={80} />
        <View style={styles.flex}>
          <AppText style={styles.displayName} numberOfLines={2}>
            {s.display_name}
          </AppText>
          <AppText variant="body" color={Colors.text2} numberOfLines={1}>
            @{s.username}
          </AppText>
          {s.is_private ? (
            <AppText variant="caption" color={Colors.gold} style={styles.privateLabel}>
              🔒 Private account
            </AppText>
          ) : null}
        </View>
      </View>

      {blockedByMe ? (
        <Card tone="accent" style={styles.gapSm}>
          <View style={styles.row}>
            <ShieldIcon size={18} color={Colors.red} />
            <AppText variant="bodySemiBold">You blocked @{s.username}</AppText>
          </View>
          <AppText variant="caption" color={Colors.text2}>
            You can&apos;t see each other&apos;s posts or interact. Unblocking doesn&apos;t restore previous follows.
          </AppText>
          <Button label="Unblock" variant="secondary" size="md" loading={blockToggle.isPending} onPress={() => doBlock(false)} />
        </Card>
      ) : (
        <>
          {tags && tags.length > 0 ? (
            <View style={styles.tags} accessibilityLabel={`Tags: ${tags.map((t) => t.label).join(", ")}`}>
              {tags.map((t) => (
                <TagChip key={t.id} id={t.id} label={t.label} />
              ))}
            </View>
          ) : null}

          {s.bio ? (
            <AppText variant="body" color={Colors.text2}>
              {s.bio}
            </AppText>
          ) : isOwn ? (
            <AppText variant="body" color={Colors.text3}>
              No bio yet. Tell people what you care about in Edit Profile.
            </AppText>
          ) : null}

          <View style={styles.metaRow}>
            {s.location ? (
              <View style={styles.meta}>
                <MapPinIcon size={13} color={Colors.text2} />
                <AppText variant="caption" color={Colors.text2}>
                  {s.location}
                </AppText>
              </View>
            ) : null}
            <View style={styles.meta}>
              <CalendarIcon size={13} color={Colors.text2} />
              <AppText variant="caption" color={Colors.text2}>
                Joined {formatJoined(s.created_at)}
              </AppText>
            </View>
          </View>

          <View style={styles.stats}>
            {stats.map((st) => (
              <View key={st.label} style={styles.stat} accessible accessibilityLabel={`${st.label}: ${st.value}`}>
                <AppText style={styles.statValue}>{st.value}</AppText>
                <AppText style={styles.statLabel} color={Colors.text2}>
                  {st.label}
                </AppText>
              </View>
            ))}
          </View>

          {isOwn ? (
            <Button label="Edit Profile" onPress={() => router.push("/settings/edit-profile")} variant="secondary" size="md" fullWidth />
          ) : (
            <View style={styles.buttons}>
              <View style={styles.flex}>
                <FollowButton userId={s.id} username={s.username} relationship={s.relationship} isPrivate={s.is_private} fullWidth />
              </View>
              <View style={styles.flex}>
                <Button label="Message · Soon" variant="secondary" size="md" fullWidth disabled onPress={() => undefined} accessibilityHint="Direct messages are coming soon" />
              </View>
            </View>
          )}

          <SegmentedTabs
            options={[
              { value: "actions", label: `Actions (${formatCount(s.post_count)})` },
              { value: "about", label: "About" },
            ]}
            value={tab}
            onChange={setTab}
          />

          {tab === "about" ? (
            <Card>
              <View style={styles.badgesHeader}>
                <TrophyIcon size={18} color="#FBBF24" />
                <AppText variant="bodyBold">Badges Earned</AppText>
              </View>
              {badges.isPending ? (
                <Skeleton height={48} radius={Radius.md} />
              ) : badges.isError ? (
                <AppText variant="caption" color={Colors.text2}>
                  Couldn&apos;t load badges. Pull down to refresh.
                </AppText>
              ) : badges.data.length === 0 ? (
                <AppText variant="caption" color={Colors.text2}>
                  No badges yet. Badges earned by taking action will appear here.
                </AppText>
              ) : (
                <View style={styles.badgeGrid}>
                  {badges.data.map((b) => (
                    <View key={b.id} style={styles.badge} accessible accessibilityLabel={`Badge: ${b.name}`}>
                      {b.emoji ? <AppText style={styles.badgeEmoji}>{b.emoji}</AppText> : null}
                      <AppText variant="caption" color={Colors.text2} align="center">
                        {b.name}
                      </AppText>
                    </View>
                  ))}
                </View>
              )}
              <View style={styles.aboutRows}>
                <AboutRow label="Location" value={s.location ?? "Not set"} muted={!s.location} />
                <AboutRow label="Member since" value={formatJoined(s.created_at)} />
                <AboutRow label="Account" value={s.is_private ? "Private" : "Public"} />
              </View>
            </Card>
          ) : !s.can_view_content ? (
            <Card tone="accent" style={styles.lockCard}>
              <AppText style={styles.lockEmoji}>🔒</AppText>
              <AppText variant="bodyBold" align="center">
                This account is private
              </AppText>
              <AppText variant="caption" color={Colors.text2} align="center">
                {s.relationship === "requested"
                  ? `Your request is pending. You'll see @${s.username}'s posts once they approve it.`
                  : `Follow @${s.username} to see their posts.`}
              </AppText>
            </Card>
          ) : null}
        </>
      )}
    </View>
  );

  const showPosts = !blockedByMe && tab === "actions" && s.can_view_content;

  return (
    <Screen padded={false} header={isOwn ? undefined : topBar} edges={isOwn ? ["top"] : ["top", "bottom"]}>
      <FlatList<Post>
        data={showPosts ? posts : []}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => <PostCard post={item} />}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={header}
        ListEmptyComponent={
          !showPosts ? undefined : postsQuery.isPending ? (
            <SkeletonCard />
          ) : postsQuery.isError ? (
            <EmptyState emoji="⚠️" title="Couldn't load posts" subtitle={postsQuery.error.message} />
          ) : (
            <EmptyState
              emoji="📭"
              title="No actions posted yet"
              subtitle={isOwn ? "Posts you share will show up here." : `@${s.username} hasn't posted yet.`}
              action={isOwn ? <Button label="Create a post" variant="action" size="md" onPress={() => router.navigate("/create")} /> : undefined}
            />
          )
        }
        ListFooterComponent={postsQuery.isFetchingNextPage ? <ActivityIndicator color={Colors.cyan} style={styles.footer} /> : undefined}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        contentContainerStyle={[styles.list, isOwn && styles.listTab]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.cyan} colors={[Colors.cyanDim]} />}
        showsVerticalScrollIndicator={false}
      />

      {!isOwn ? (
        <>
          <BottomSheet visible={menuOpen && !confirmBlock} onClose={() => setMenuOpen(false)} title={`@${s.username}`}>
            {blockedByMe ? (
              <Button label="Unblock" variant="secondary" fullWidth loading={blockToggle.isPending} onPress={() => doBlock(false)} />
            ) : (
              <Button label={`Block @${s.username}`} variant="destructive" fullWidth onPress={() => setConfirmBlock(true)} />
            )}
            <Button label="Cancel" variant="ghost" fullWidth onPress={() => setMenuOpen(false)} />
          </BottomSheet>
          <BottomSheet
            visible={confirmBlock}
            onClose={() => setConfirmBlock(false)}
            dismissible={!blockToggle.isPending}
            title={`Block @${s.username}?`}
            message="You'll stop following each other, pending requests are removed, and neither of you will see the other's profile or posts. They won't be told."
          >
            <Button label="Block" variant="danger" fullWidth loading={blockToggle.isPending} onPress={() => doBlock(true)} />
            <Button label="Cancel" variant="secondary" fullWidth disabled={blockToggle.isPending} onPress={() => setConfirmBlock(false)} />
          </BottomSheet>
        </>
      ) : null}
    </Screen>
  );
}

function Separator() {
  return <View style={{ height: Spacing.lg }} />;
}

function AboutRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <View style={styles.aboutRow}>
      <AppText variant="body" color={Colors.text2}>
        {label}
      </AppText>
      <AppText variant="body" color={muted ? Colors.text3 : Colors.text1} style={styles.aboutValue} numberOfLines={1}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxxl * 2 },
  listTab: { paddingBottom: 120 },
  headerBlock: { gap: Spacing.lg, marginBottom: Spacing.lg },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: Spacing.lg },
  topActions: { flexDirection: "row", gap: Spacing.sm },
  identity: { flexDirection: "row", alignItems: "center", gap: Spacing.lg },
  flex: { flex: 1, minWidth: 0 },
  gapSm: { gap: Spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  displayName: { fontFamily: FontFamily.displayBlack, fontSize: 20, lineHeight: 26 },
  privateLabel: { marginTop: 2 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.md },
  meta: { flexDirection: "row", alignItems: "center", gap: 6 },
  stats: { flexDirection: "row", gap: Spacing.sm },
  stat: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.hairline,
    paddingVertical: Spacing.md,
    alignItems: "center",
  },
  statValue: { fontFamily: FontFamily.displayBlack, fontSize: 16, lineHeight: 22 },
  statLabel: { fontFamily: FontFamily.regular, fontSize: 10, lineHeight: 14, marginTop: 2 },
  buttons: { flexDirection: "row", gap: Spacing.md },
  lockCard: { alignItems: "center", gap: Spacing.sm, paddingVertical: Spacing.xxl },
  lockEmoji: { fontSize: 32, lineHeight: 40 },
  badgesHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.md },
  badgeGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.md },
  badge: { backgroundColor: Colors.elevated, borderRadius: Radius.md, padding: Spacing.md, minWidth: 70, alignItems: "center", gap: 4 },
  badgeEmoji: { fontSize: 24, lineHeight: 30 },
  aboutRows: { marginTop: Spacing.lg, paddingTop: Spacing.lg, borderTopWidth: 1, borderTopColor: Colors.hairline, gap: Spacing.sm },
  aboutRow: { flexDirection: "row", justifyContent: "space-between", gap: Spacing.md },
  aboutValue: { flexShrink: 1, textAlign: "right" },
  footer: { marginVertical: Spacing.xl },
});
