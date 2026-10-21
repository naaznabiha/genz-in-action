import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, StyleSheet, View } from "react-native";

import ImpactCard from "@/components/home/impact-card";
import { BellIcon, ChevronRightIcon, SearchIcon } from "@/components/icons";
import AppText from "@/components/ui/app-text";
import Avatar from "@/components/ui/avatar";
import Card from "@/components/ui/card";
import GenzLogo from "@/components/ui/genz-logo";
import IconButton from "@/components/ui/icon-button";
import Screen from "@/components/ui/screen";
import { Skeleton } from "@/components/ui/skeleton";
import { Colors, FontFamily, Spacing } from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";
import { impactKeys } from "@/hooks/use-impact";
import { profileKeys, useMyProfile, useMyProfileTags } from "@/hooks/use-profile";
import { avatarPublicUrl } from "@/services/profile";

/**
 * Home dashboard (spec FR-06, FR-07; prototype HomeScreen header + weekly impact card).
 * Feed, suggestions and trending arrive with their phases; until then the screen
 * shows only real data (the signed-in user's profile and server-derived impact).
 */
export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: profile, isPending, isError, refetch } = useMyProfile();
  const { data: tags } = useMyProfileTags();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    if (!user) return;
    setRefreshing(true);
    await Promise.allSettled([
      queryClient.invalidateQueries({ queryKey: profileKeys.detail(user.id) }),
      queryClient.invalidateQueries({ queryKey: impactKeys.mine(user.id) }),
    ]);
    setRefreshing(false);
  };

  const missing: string[] = [];
  if (profile && !profile.avatar_path) missing.push("a photo");
  if (profile && !profile.bio) missing.push("a bio");
  if (profile && tags && tags.length === 0) missing.push("tags");

  return (
    <Screen
      scroll
      contentStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.cyan} colors={[Colors.cyanDim]} />}
    >
      {/* Header: logo + greeting, global actions (FR-06) */}
      <View style={styles.header}>
        <View style={styles.greeting}>
          <GenzLogo size="md" variant="mark" />
          <View style={styles.flex}>
            <AppText style={styles.welcome} color={Colors.text3}>
              Welcome back,
            </AppText>
            {isPending ? (
              <Skeleton width={120} height={18} />
            ) : (
              <AppText style={styles.name} numberOfLines={1} accessibilityRole="header">
                {profile?.display_name ?? "there"}
              </AppText>
            )}
          </View>
        </View>
        <View style={styles.actions}>
          <IconButton
            icon={<SearchIcon size={18} color={Colors.text3} />}
            onPress={() => router.push("/search")}
            accessibilityLabel="Search"
          />
          <IconButton
            icon={<BellIcon size={18} color={Colors.text3} />}
            onPress={() => router.push("/notifications")}
            accessibilityLabel="Notifications"
          />
          <Avatar
            name={profile?.display_name ?? "Your profile"}
            uri={avatarPublicUrl(profile?.avatar_path)}
            size={36}
            onPress={() => router.navigate("/profile")}
          />
        </View>
      </View>

      {isError ? (
        <Pressable onPress={() => void refetch()} accessibilityRole="button" style={styles.errorBanner}>
          <AppText variant="caption" color={Colors.red}>
            Couldn&apos;t load your profile. Tap to retry.
          </AppText>
        </Pressable>
      ) : null}

      <ImpactCard />

      {missing.length > 0 ? (
        <Pressable
          onPress={() => router.push("/settings/edit-profile")}
          accessibilityRole="button"
          accessibilityLabel={`Complete your profile: add ${missing.join(", ")}`}
          style={({ pressed }) => [styles.section, pressed && styles.pressed]}
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

      <View style={styles.section}>
        <AppText variant="bodyBold" style={styles.sectionTitle}>
          📋 Action Feed
        </AppText>
        <Card>
          <AppText variant="bodySemiBold" align="center">
            Your feed is on its way
          </AppText>
          <AppText variant="caption" color={Colors.text2} align="center" style={styles.feedText}>
            Posts, people to follow and trending causes will appear here once posting launches.
          </AppText>
        </Card>
      </View>
    </Screen>
  );
}

function formatList(items: string[]) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

const styles = StyleSheet.create({
  content: { paddingBottom: 120, gap: Spacing.lg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: Spacing.lg, gap: Spacing.md },
  greeting: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, flex: 1, minWidth: 0 },
  flex: { flex: 1, minWidth: 0 },
  welcome: { fontFamily: FontFamily.medium, fontSize: 11, lineHeight: 14 },
  name: { fontFamily: FontFamily.displayBlack, fontSize: 17, lineHeight: 22 },
  actions: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  errorBanner: { paddingVertical: Spacing.sm },
  section: { gap: Spacing.sm },
  sectionTitle: { fontFamily: FontFamily.displayBold },
  pressed: { opacity: 0.85 },
  completeCard: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  completeText: { marginTop: 2 },
  feedText: { marginTop: Spacing.xs },
});
