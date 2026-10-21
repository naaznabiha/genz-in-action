import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import AppText from "@/components/ui/app-text";
import Avatar from "@/components/ui/avatar";
import Button from "@/components/ui/button";
import EmptyState from "@/components/ui/empty-state";
import Screen from "@/components/ui/screen";
import ScreenHeader from "@/components/ui/screen-header";
import { useToast } from "@/components/ui/toast";
import { Colors, Radius, Spacing } from "@/constants/theme";
import { useMyProfile } from "@/hooks/use-profile";
import { useFollowRequests, useRespondToRequest } from "@/hooks/use-social";
import { relativeTime } from "@/lib/time";
import { avatarPublicUrl } from "@/services/profile";

/** Pending follow requests for a private account (spec §5.6, FR-11; prototype FollowRequestsScreen). */
export default function FollowRequestsScreen() {
  const router = useRouter();
  const toast = useToast();
  const me = useMyProfile();
  const requests = useFollowRequests();
  const respond = useRespondToRequest();
  const [busyId, setBusyId] = useState<string | null>(null);

  const act = (requesterId: string, accept: boolean, username: string) => {
    setBusyId(requesterId);
    respond.mutate(
      { requesterId, accept },
      {
        onSuccess: () => toast.show(accept ? `@${username} can now see your posts` : "Request declined", "success"),
        onError: (e) => toast.show(e instanceof Error ? e.message : "Something went wrong.", "error"),
        onSettled: () => setBusyId(null),
      },
    );
  };

  return (
    <Screen scroll header={<ScreenHeader title="Follow Requests" back />} edges={["top", "bottom"]} contentStyle={styles.content}>
      {me.data && !me.data.is_private ? (
        <AppText variant="caption" color={Colors.text3} style={styles.note}>
          Your account is public, so people can follow you without a request.
        </AppText>
      ) : null}

      {requests.isPending ? (
        <ActivityIndicator color={Colors.cyan} style={styles.loading} />
      ) : requests.isError ? (
        <EmptyState
          emoji="⚠️"
          title="Couldn't load requests"
          subtitle={requests.error.message}
          action={<Button label="Try again" variant="secondary" size="md" onPress={() => void requests.refetch()} />}
        />
      ) : requests.data.length === 0 ? (
        <EmptyState emoji="📭" title="No pending requests" subtitle="When someone asks to follow your private account, it shows up here." />
      ) : (
        <View style={styles.list}>
          {requests.data.map((r) => (
            <View key={r.id} style={styles.row}>
              <Pressable
                onPress={() => router.push({ pathname: "/user/[id]", params: { id: r.id } })}
                style={styles.person}
                accessibilityRole="button"
                accessibilityLabel={`Open ${r.display_name}'s profile`}
              >
                <Avatar name={r.display_name} uri={avatarPublicUrl(r.avatar_path)} size={42} />
                <View style={styles.flex}>
                  <AppText variant="bodyBold" numberOfLines={1}>
                    {r.display_name}
                  </AppText>
                  <AppText variant="caption" color={Colors.text3} numberOfLines={1}>
                    @{r.username} · {relativeTime(r.requested_at)}
                  </AppText>
                </View>
              </Pressable>
              <View style={styles.actions}>
                <Button label="Accept" size="sm" variant="action" loading={busyId === r.id && respond.variables?.accept === true} disabled={busyId === r.id} onPress={() => act(r.id, true, r.username)} />
                <Button label="Decline" size="sm" variant="secondary" disabled={busyId === r.id} onPress={() => act(r.id, false, r.username)} />
              </View>
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: Spacing.sm },
  note: { marginBottom: Spacing.md },
  loading: { marginTop: Spacing.xxl },
  list: { gap: Spacing.md },
  row: {
    padding: Spacing.md,
    gap: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.hairline,
  },
  person: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  flex: { flex: 1, minWidth: 0 },
  actions: { flexDirection: "row", gap: Spacing.sm, justifyContent: "flex-end" },
});
