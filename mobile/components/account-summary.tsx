import { useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { LogOutIcon } from "@/components/icons";
import AppText from "@/components/ui/app-text";
import Avatar from "@/components/ui/avatar";
import Button from "@/components/ui/button";
import Card from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { Colors, Spacing } from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";
import { useMyProfile } from "@/hooks/use-profile";

/**
 * Phase 1 account card: shows the profile row created at signup and the
 * Log out action (spec §5.4). Phase 2 moves Log out into Settings and replaces
 * this with the real profile screen.
 */
export default function AccountSummary() {
  const { user, signOut } = useAuth();
  const toast = useToast();
  const { data: profile, isPending, isError, error, refetch } = useMyProfile();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } catch {
      // The local session is cleared regardless (hooks/use-auth.tsx); the server call can fail offline.
      toast.show("Signed out on this device.", "info");
    } finally {
      setSigningOut(false);
    }
  };

  const joined = profile
    ? new Date(profile.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : "";

  return (
    <Card tone="accent">
      {isPending ? (
        <ActivityIndicator color={Colors.cyan} />
      ) : isError ? (
        <View style={styles.gap}>
          <AppText variant="body" color={Colors.red}>
            Couldn&apos;t load your profile: {error.message}
          </AppText>
          <Button label="Try again" onPress={() => void refetch()} variant="secondary" size="sm" />
        </View>
      ) : !profile ? (
        <AppText variant="body" color={Colors.gold}>
          No profile row found for this account. Run the Phase 1 backfill migration (supabase/README.md).
        </AppText>
      ) : (
        <View style={styles.row}>
          <Avatar name={profile.display_name} uri={profile.avatar_url} size={48} />
          <View style={styles.flex}>
            <AppText variant="subheading" numberOfLines={1}>
              {profile.display_name}
            </AppText>
            <AppText variant="body" color={Colors.cyan} numberOfLines={1}>
              @{profile.username}
            </AppText>
            <AppText variant="caption" color={Colors.text3} numberOfLines={1}>
              {user?.email} · Joined {joined}
            </AppText>
          </View>
        </View>
      )}
      <Button
        label="Log out"
        onPress={handleSignOut}
        loading={signingOut}
        variant="destructive"
        size="md"
        fullWidth
        leftIcon={<LogOutIcon size={16} color={Colors.red} />}
        style={styles.logout}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  flex: { flex: 1 },
  gap: { gap: Spacing.sm },
  logout: { marginTop: Spacing.lg },
});
