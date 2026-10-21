import { StyleSheet, View } from "react-native";

import { ShieldIcon } from "@/components/icons";
import AppText from "@/components/ui/app-text";
import EmptyState from "@/components/ui/empty-state";
import Screen from "@/components/ui/screen";
import ScreenHeader from "@/components/ui/screen-header";
import { Colors, Radius, Spacing } from "@/constants/theme";

/**
 * Blocked Users (spec FR-20; prototype PrivacySubScreens BlockedUsersScreen).
 * Blocking itself (the `blocks` table, block/unblock actions and their
 * server-side effects, spec §11) ships with the social graph in Phase 3.
 * Until then nobody can be blocked, so the honest state is an empty list.
 * TODO(Phase 3): load the signed-in user's blocks and add Unblock with confirmation.
 */
export default function BlockedUsersScreen() {
  return (
    <Screen scroll header={<ScreenHeader title="Blocked Users" back />} edges={["top", "bottom"]}>
      <View style={styles.info}>
        <ShieldIcon size={18} color={Colors.gold} />
        <AppText variant="caption" color={Colors.text2} style={styles.flex}>
          When blocking launches, people you block won&apos;t be able to follow you, see your posts or find your profile in
          search. They won&apos;t be told they were blocked.
        </AppText>
      </View>
      <EmptyState
        emoji="🛡️"
        title="No one is blocked"
        subtitle="Blocking arrives together with following. People you block from their profile will appear here."
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  info: {
    flexDirection: "row",
    gap: Spacing.md,
    alignItems: "flex-start",
    padding: Spacing.lg,
    marginTop: Spacing.sm,
    borderRadius: Radius.lg,
    backgroundColor: "rgba(255,215,0,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.2)",
  },
  flex: { flex: 1 },
});
