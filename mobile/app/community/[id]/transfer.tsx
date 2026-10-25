import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from "react-native";

import { RoleChip } from "@/components/communities/community-bits";
import AppText from "@/components/ui/app-text";
import Avatar from "@/components/ui/avatar";
import BottomSheet from "@/components/ui/bottom-sheet";
import Button from "@/components/ui/button";
import EmptyState from "@/components/ui/empty-state";
import Screen from "@/components/ui/screen";
import ScreenHeader from "@/components/ui/screen-header";
import { useToast } from "@/components/ui/toast";
import { Colors, Radius, Spacing } from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";
import { useCommunity, useCommunityMembers, useDeleteCommunity, useLeaveCommunity, useTransferOwnership } from "@/hooks/use-communities";
import { avatarPublicUrl } from "@/services/profile";
import type { CommunityMember } from "@/types/community";

/**
 * Hand over ownership (approved board "Leave"). The owner can't leave until
 * someone else owns the community; the old owner becomes an admin and can
 * then stay or leave. An owner who is the only member may delete it (D53).
 * With ?to=<user> (Members → Make owner) that member is preselected.
 */
export default function TransferOwnershipScreen() {
  const { id, to } = useLocalSearchParams<{ id: string; to?: string }>();
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const community = useCommunity(id);
  const c = community.data;
  const members = useCommunityMembers(id, Boolean(c?.can_read));
  const transfer = useTransferOwnership(id);
  const leave = useLeaveCommunity();
  const remove = useDeleteCommunity();
  const [pick, setPick] = useState<string | null>(to ?? null);
  const [confirm, setConfirm] = useState<null | "transfer" | "delete">(null);
  const fromMembers = !to; // came from "Leave community"

  const candidates = useMemo(() => (members.data?.pages.flatMap((p) => p.members) ?? []).filter((m) => m.user_id !== user?.id), [members.data, user?.id]);
  const chosen = candidates.find((m) => m.user_id === pick) ?? null;

  if (c && c.my_role !== "owner") {
    return (
      <Screen header={<ScreenHeader back title="New owner" />} edges={["top", "bottom"]}>
        <EmptyState emoji="🔒" title="Only the owner can do this" action={<Button label="Go back" variant="secondary" size="md" onPress={() => router.back()} />} />
      </Screen>
    );
  }

  const doTransfer = (andLeave: boolean) =>
    chosen &&
    transfer.mutate(chosen.user_id, {
      onSuccess: () => {
        if (!andLeave) {
          setConfirm(null);
          toast.show(`${chosen.display_name} is now the owner. You're an admin.`, "success");
          router.back();
          return;
        }
        leave.mutate(id, {
          onSuccess: () => {
            setConfirm(null);
            toast.show(`${chosen.display_name} is now the owner. You left.`, "success");
            router.dismissTo("/explore");
          },
          onError: (e) => toast.show(e.message, "error"),
        });
      },
      onError: (e) => toast.show(e.message, "error"),
    });

  return (
    <Screen padded={false} header={<ScreenHeader back title={fromMembers ? "Leave community" : "Make owner"} />} edges={["top", "bottom"]}>
      <FlatList<CommunityMember>
        data={candidates}
        keyExtractor={(m) => m.user_id}
        ListHeaderComponent={
          <View style={styles.intro}>
            <AppText variant="bodyBold">{fromMembers ? "Choose a new owner first" : "Hand over ownership"}</AppText>
            <AppText variant="caption" color={Colors.text2}>
              {c?.name ?? "This community"} needs an owner. The new owner can appoint admins and hand it over again. You&apos;ll become an admin.
            </AppText>
          </View>
        }
        renderItem={({ item: m }) => {
          const selected = m.user_id === pick;
          return (
            <Pressable
              onPress={() => setPick(m.user_id)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`${m.display_name}, ${m.role}`}
              style={[styles.row, selected && styles.rowSelected]}
            >
              <Avatar name={m.display_name} uri={avatarPublicUrl(m.avatar_path)} size={40} />
              <View style={styles.flex}>
                <AppText variant="bodySemiBold" numberOfLines={1}>
                  {m.display_name}
                </AppText>
                <AppText variant="caption" color={Colors.text3}>
                  @{m.username}
                </AppText>
              </View>
              <RoleChip role={m.role} />
              <View style={[styles.radio, selected && styles.radioOn]}>{selected ? <View style={styles.radioDot} /> : null}</View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          members.isPending || community.isPending ? (
            <ActivityIndicator color={Colors.cyan} style={styles.loading} />
          ) : (
            <View style={styles.solo}>
              <AppText variant="body" color={Colors.text2} align="center">
                You&apos;re the only member, so there&apos;s no one to hand it to. You can delete the community instead.
              </AppText>
              <Button label="Delete community" variant="destructive" size="md" onPress={() => setConfirm("delete")} />
            </View>
          )
        }
        onEndReached={() => {
          if (members.hasNextPage && !members.isFetchingNextPage) void members.fetchNextPage();
        }}
        contentContainerStyle={styles.list}
      />
      {chosen ? (
        <View style={styles.footer}>
          <Button label={`Make ${chosen.display_name.split(" ")[0]} the owner`} variant="action" fullWidth onPress={() => setConfirm("transfer")} />
        </View>
      ) : null}

      <BottomSheet
        visible={confirm === "transfer"}
        onClose={() => setConfirm(null)}
        title={`Make ${chosen?.display_name ?? ""} the owner?`}
        message="They'll be notified. You become an admin — you can stay, or leave now."
      >
        {fromMembers ? (
          <Button label="Make owner and leave" variant="danger" fullWidth loading={transfer.isPending || leave.isPending} onPress={() => doTransfer(true)} />
        ) : null}
        <Button label={fromMembers ? "Make owner and stay" : "Make owner"} variant={fromMembers ? "secondary" : "action"} fullWidth loading={!fromMembers && transfer.isPending} onPress={() => doTransfer(false)} />
        <Button label="Cancel" variant="ghost" fullWidth onPress={() => setConfirm(null)} />
      </BottomSheet>

      <BottomSheet visible={confirm === "delete"} onClose={() => setConfirm(null)} title="Delete this community?" message="Its discussion, content and community posts are removed for good.">
        <Button
          label="Delete community"
          variant="danger"
          fullWidth
          loading={remove.isPending}
          onPress={() =>
            remove.mutate(id, {
              onSuccess: () => {
                setConfirm(null);
                toast.show("Community deleted", "success");
                router.dismissTo("/explore");
              },
              onError: (e) => toast.show(e.message, "error"),
            })
          }
        />
        <Button label="Cancel" variant="secondary" fullWidth onPress={() => setConfirm(null)} />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: Spacing.xl, paddingBottom: 120, gap: Spacing.sm },
  loading: { marginTop: 40 },
  intro: { gap: Spacing.xs, marginBottom: Spacing.lg, padding: Spacing.lg, borderRadius: Radius.lg, backgroundColor: "rgba(255,215,0,0.07)", borderWidth: 1, borderColor: "rgba(255,215,0,0.25)" },
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.lg, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.hairline, marginBottom: Spacing.sm },
  rowSelected: { borderColor: Colors.cyanDim, backgroundColor: Colors.elevated },
  flex: { flex: 1, minWidth: 0 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  radioOn: { borderColor: Colors.cyanDim, backgroundColor: Colors.cyanDim },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.text1 },
  solo: { gap: Spacing.lg, alignItems: "center", paddingVertical: Spacing.xxl },
  footer: { padding: Spacing.xl, borderTopWidth: 1, borderTopColor: Colors.divider },
});
