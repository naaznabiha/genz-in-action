import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";

import { CalendarIcon, EditIcon, MapPinIcon, SettingsIcon, TrophyIcon } from "@/components/icons";
import TagChip from "@/components/profile/tag-chip";
import AppText from "@/components/ui/app-text";
import Avatar from "@/components/ui/avatar";
import Button from "@/components/ui/button";
import Card from "@/components/ui/card";
import EmptyState from "@/components/ui/empty-state";
import IconButton from "@/components/ui/icon-button";
import Screen from "@/components/ui/screen";
import SegmentedTabs from "@/components/ui/segmented-tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Colors, FontFamily, Radius, Spacing } from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";
import { impactKeys, useMyImpactSummary } from "@/hooks/use-impact";
import { profileKeys, useMyBadges, useMyProfile, useMyProfileTags } from "@/hooks/use-profile";
import { avatarPublicUrl } from "@/services/profile";
import type { ImpactSummary } from "@/types/impact";

type ProfileTab = "actions" | "about";

function formatJoined(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

/**
 * "Impact" stat. Points are shown only when an approved formula produced them.
 * With no formula yet: a user with no recorded actions honestly has 0; a user
 * with actions shows "—" (not scored yet) rather than an invented number.
 */
function impactLabel(summary: ImpactSummary | undefined) {
  if (!summary) return "—";
  if (summary.formula_status === "approved" && summary.impact_points !== null) return String(summary.impact_points);
  return summary.total_actions === 0 ? "0" : "—";
}

/**
 * Own profile (spec FR-16, FR-17; prototype ProfileScreen, own-profile mode).
 * Always shows the authenticated user's data — the screen takes no user id.
 * Followers/Following are 0 because following does not exist until Phase 3/M6;
 * Actions and Impact come from the server-side activity ledger.
 */
export default function ProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<ProfileTab>("actions");
  const [refreshing, setRefreshing] = useState(false);
  const { data: profile, isPending, isError, error, refetch } = useMyProfile();
  const { data: tags } = useMyProfileTags();
  const { data: impact } = useMyImpactSummary();
  const badges = useMyBadges();

  const onRefresh = async () => {
    if (!user) return;
    setRefreshing(true);
    await Promise.allSettled([
      queryClient.invalidateQueries({ queryKey: profileKeys.detail(user.id) }),
      queryClient.invalidateQueries({ queryKey: impactKeys.mine(user.id) }),
    ]);
    setRefreshing(false);
  };

  const header = (
    <View style={styles.topBar}>
      <AppText variant="title" accessibilityRole="header">
        Profile
      </AppText>
      <View style={styles.topActions}>
        <IconButton
          icon={<EditIcon size={17} color={Colors.text2} />}
          onPress={() => router.push("/settings/edit-profile")}
          accessibilityLabel="Edit profile"
        />
        <IconButton
          icon={<SettingsIcon size={17} color={Colors.text2} />}
          onPress={() => router.push("/settings")}
          accessibilityLabel="Settings"
        />
      </View>
    </View>
  );

  if (isPending) {
    return (
      <Screen scroll contentStyle={styles.content}>
        {header}
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

  if (isError || !profile) {
    return (
      <Screen scroll contentStyle={styles.content}>
        {header}
        <EmptyState
          emoji="⚠️"
          title="Couldn't load your profile"
          subtitle={isError ? error.message : "No profile was found for this account. Run the Phase 1 backfill migration (supabase/README.md)."}
          action={<Button label="Try again" onPress={() => void refetch()} variant="secondary" size="md" />}
        />
      </Screen>
    );
  }

  const stats = [
    { label: "Actions", value: impact ? String(impact.total_actions) : "—" },
    { label: "Followers", value: "0" },
    { label: "Following", value: "0" },
    { label: "Impact", value: impactLabel(impact) },
  ];

  return (
    <Screen
      scroll
      contentStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.cyan} colors={[Colors.cyanDim]} />}
    >
      {header}

      <View style={styles.identity}>
        <Avatar name={profile.display_name} uri={avatarPublicUrl(profile.avatar_path)} size={80} />
        <View style={styles.flex}>
          <AppText style={styles.displayName} numberOfLines={2}>
            {profile.display_name}
          </AppText>
          <AppText variant="body" color={Colors.text2} numberOfLines={1}>
            @{profile.username}
          </AppText>
          {profile.is_private ? (
            <AppText variant="caption" color={Colors.gold} style={styles.privateLabel}>
              Private account
            </AppText>
          ) : null}
        </View>
      </View>

      {tags && tags.length > 0 ? (
        <View style={styles.tags} accessibilityLabel={`Tags: ${tags.map((t) => t.label).join(", ")}`}>
          {tags.map((t) => (
            <TagChip key={t.id} id={t.id} label={t.label} />
          ))}
        </View>
      ) : null}

      {profile.bio ? (
        <AppText variant="body" color={Colors.text2}>
          {profile.bio}
        </AppText>
      ) : (
        <AppText variant="body" color={Colors.text3}>
          No bio yet. Tell people what you care about in Edit Profile.
        </AppText>
      )}

      <View style={styles.metaRow}>
        {profile.location ? (
          <View style={styles.meta}>
            <MapPinIcon size={13} color={Colors.text2} />
            <AppText variant="caption" color={Colors.text2}>
              {profile.location}
            </AppText>
          </View>
        ) : null}
        <View style={styles.meta}>
          <CalendarIcon size={13} color={Colors.text2} />
          <AppText variant="caption" color={Colors.text2}>
            Joined {formatJoined(profile.created_at)}
          </AppText>
        </View>
      </View>

      <View style={styles.stats}>
        {stats.map((s) => (
          <View key={s.label} style={styles.stat} accessible accessibilityLabel={`${s.label}: ${s.value}`}>
            <AppText style={styles.statValue}>{s.value}</AppText>
            <AppText style={styles.statLabel} color={Colors.text2}>
              {s.label}
            </AppText>
          </View>
        ))}
      </View>

      <Button label="Edit Profile" onPress={() => router.push("/settings/edit-profile")} variant="secondary" size="md" fullWidth />

      <SegmentedTabs
        options={[
          { value: "actions", label: "Actions (0)" },
          { value: "about", label: "About" },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "actions" ? (
        <EmptyState
          emoji="📭"
          title="No actions posted yet"
          subtitle="Posts and actions you share will show up here once posting launches."
        />
      ) : (
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
              No badges yet. Badges you earn by taking action will appear here.
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
            <AboutRow label="Location" value={profile.location ?? "Not set"} muted={!profile.location} />
            <AboutRow label="Member since" value={formatJoined(profile.created_at)} />
            <AboutRow label="Account" value={profile.is_private ? "Private" : "Public"} />
          </View>
        </Card>
      )}
    </Screen>
  );
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
  content: { paddingBottom: 120, gap: Spacing.lg },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: Spacing.lg },
  topActions: { flexDirection: "row", gap: Spacing.sm },
  identity: { flexDirection: "row", alignItems: "center", gap: Spacing.lg },
  flex: { flex: 1, minWidth: 0 },
  gapSm: { gap: Spacing.sm },
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
  badgesHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.md },
  badgeGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.md },
  badge: { backgroundColor: Colors.elevated, borderRadius: Radius.md, padding: Spacing.md, minWidth: 70, alignItems: "center", gap: 4 },
  badgeEmoji: { fontSize: 24, lineHeight: 30 },
  aboutRows: { marginTop: Spacing.lg, paddingTop: Spacing.lg, borderTopWidth: 1, borderTopColor: Colors.hairline, gap: Spacing.sm },
  aboutRow: { flexDirection: "row", justifyContent: "space-between", gap: Spacing.md },
  aboutValue: { flexShrink: 1, textAlign: "right" },
});
