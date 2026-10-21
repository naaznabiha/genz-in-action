import { useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { ShieldIcon } from "@/components/icons";
import AppText from "@/components/ui/app-text";
import Avatar from "@/components/ui/avatar";
import BottomSheet from "@/components/ui/bottom-sheet";
import Button from "@/components/ui/button";
import EmptyState from "@/components/ui/empty-state";
import Screen from "@/components/ui/screen";
import ScreenHeader from "@/components/ui/screen-header";
import { useToast } from "@/components/ui/toast";
import { Colors, Radius, Spacing } from "@/constants/theme";
import { useBlockToggle, useBlockedUsers } from "@/hooks/use-social";
import { relativeTime } from "@/lib/time";
import { avatarPublicUrl } from "@/services/profile";
import type { BlockedUser } from "@/types/social";

/** Blocked Users (spec FR-20; prototype PrivacySubScreens BlockedUsersScreen). Block from a profile's ••• menu. */
export default function BlockedUsersScreen() {
  const toast = useToast();
  const blocked = useBlockedUsers();
  const toggle = useBlockToggle();
  const [target, setTarget] = useState<BlockedUser | null>(null);

  const unblock = () => {
    if (!target) return;
    toggle.mutate(
      { userId: target.id, block: false },
      {
        onSuccess: () => {
          toast.show(`${target.display_name} unblocked`, "success");
          setTarget(null);
        },
        onError: (e) => toast.show(e instanceof Error ? e.message : "Something went wrong.", "error"),
      },
    );
  };

  return (
    <Screen scroll header={<ScreenHeader title="Blocked Users" back />} edges={["top", "bottom"]}>
      <View style={styles.info}>
        <ShieldIcon size={18} color={Colors.gold} />
        <AppText variant="caption" color={Colors.text2} style={styles.flex}>
          Blocked people can&apos;t follow you, see your posts or find your profile, and you won&apos;t see theirs. They aren&apos;t told they were blocked.
        </AppText>
      </View>

      {blocked.isPending ? (
        <ActivityIndicator color={Colors.cyan} style={styles.loading} />
      ) : blocked.isError ? (
        <EmptyState
          emoji="⚠️"
          title="Couldn't load blocked users"
          subtitle={blocked.error.message}
          action={<Button label="Try again" variant="secondary" size="md" onPress={() => void blocked.refetch()} />}
        />
      ) : blocked.data.length === 0 ? (
        <EmptyState emoji="🛡️" title="No one is blocked" subtitle="Anyone you block from their profile appears here." />
      ) : (
        <View style={styles.list}>
          {blocked.data.map((b) => (
            <View key={b.id} style={styles.row}>
              <Avatar name={b.display_name} uri={avatarPublicUrl(b.avatar_path)} size={42} />
              <View style={styles.flex}>
                <AppText variant="bodyBold" numberOfLines={1}>
                  {b.display_name}
                </AppText>
                <AppText variant="caption" color={Colors.text3} numberOfLines={1}>
                  @{b.username} · blocked {relativeTime(b.blocked_at)}
                </AppText>
              </View>
              <Button label="Unblock" size="sm" variant="secondary" onPress={() => setTarget(b)} />
            </View>
          ))}
        </View>
      )}

      <BottomSheet
        visible={target !== null}
        onClose={() => setTarget(null)}
        dismissible={!toggle.isPending}
        title={target ? `Unblock ${target.display_name}?` : ""}
        message="They'll be able to see your profile and posts and follow you again. Previous follows are not restored."
      >
        <Button label="Yes, unblock" fullWidth loading={toggle.isPending} onPress={unblock} />
        <Button label="Keep blocked" variant="secondary" fullWidth disabled={toggle.isPending} onPress={() => setTarget(null)} />
      </BottomSheet>
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
    marginBottom: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: "rgba(255,215,0,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.2)",
  },
  flex: { flex: 1, minWidth: 0 },
  loading: { marginTop: Spacing.xxl },
  list: { gap: Spacing.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.hairline,
  },
});
