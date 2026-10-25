import { useRouter } from "expo-router";
import { memo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { CommunityAvatar, PrivacyChip, RoleChip } from "@/components/communities/community-bits";
import { ChevronRightIcon, PlusIcon } from "@/components/icons";
import AppText from "@/components/ui/app-text";
import Button from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { Colors, FontFamily, Radius, Spacing } from "@/constants/theme";
import { useCommunities, useMyCommunityInvites, useRespondToInvite } from "@/hooks/use-communities";
import { formatCount } from "@/lib/time";
import type { CommunitySummary, MyCommunityInvite } from "@/types/community";

/**
 * Explore → Communities (approved board "Main"): Create card, Invitations
 * (Accept / Decline inline), Your communities with your role, then the
 * paginated Discover list (rendered by Explore's list as CommunityCard rows).
 */
export function CommunitiesHeader() {
  const router = useRouter();
  const invites = useMyCommunityInvites();
  const mine = useCommunities("mine");
  const myList = mine.data?.pages.flatMap((p) => p.communities) ?? [];

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => router.push("/community/create")}
        accessibilityRole="button"
        accessibilityLabel="Create a community. Public or private, you'll be the owner."
        style={({ pressed }) => [styles.create, pressed && styles.pressed]}
      >
        <View style={styles.createIcon}>
          <PlusIcon size={20} color={Colors.bg} />
        </View>
        <View style={styles.flex}>
          <AppText variant="bodyBold">Create a community</AppText>
          <AppText variant="caption" color={Colors.text2}>
            Public or private · you&apos;ll be the owner
          </AppText>
        </View>
        <ChevronRightIcon size={18} color={Colors.text3} />
      </Pressable>

      {invites.data && invites.data.length > 0 ? (
        <View style={styles.section}>
          <SectionTitle>Invitations</SectionTitle>
          {invites.data.map((inv) => (
            <InviteCard key={inv.invite_id} invite={inv} />
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionTitle>Your communities</SectionTitle>
        {mine.isPending ? (
          <Skeleton height={56} radius={Radius.lg} />
        ) : mine.isError ? (
          <Pressable onPress={() => void mine.refetch()} accessibilityRole="button">
            <AppText variant="caption" color={Colors.red}>
              Couldn&apos;t load your communities. Tap to retry.
            </AppText>
          </Pressable>
        ) : myList.length === 0 ? (
          <AppText variant="caption" color={Colors.text3}>
            You haven&apos;t joined any communities yet. Join one below or create your own.
          </AppText>
        ) : (
          <View style={styles.mineList}>
            {myList.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => router.push({ pathname: "/community/[id]", params: { id: c.id } })}
                accessibilityRole="button"
                accessibilityLabel={`${c.name}, ${c.my_role}`}
                style={({ pressed }) => [styles.mineRow, pressed && styles.pressed]}
              >
                <CommunityAvatar id={c.id} name={c.name} imagePath={c.image_path} size={40} />
                <AppText variant="bodySemiBold" style={styles.flex} numberOfLines={1}>
                  {c.name}
                </AppText>
                {c.my_role ? <RoleChip role={c.my_role} /> : null}
              </Pressable>
            ))}
            {mine.hasNextPage ? (
              <Button label="Show more" variant="ghost" size="sm" onPress={() => void mine.fetchNextPage()} loading={mine.isFetchingNextPage} />
            ) : null}
          </View>
        )}
      </View>

      <SectionTitle>Discover</SectionTitle>
    </View>
  );
}

function InviteCard({ invite }: { invite: MyCommunityInvite }) {
  const router = useRouter();
  const toast = useToast();
  const respond = useRespondToInvite();
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);

  const answer = (accept: boolean) => {
    setBusy(accept ? "accept" : "decline");
    respond.mutate(
      { inviteId: invite.invite_id, accept },
      {
        onSuccess: () => {
          toast.show(accept ? `You joined ${invite.community_name}` : "Invite declined", "success");
          if (accept) router.push({ pathname: "/community/[id]", params: { id: invite.community_id } });
        },
        onError: (e) => toast.show(e.message, "error"),
        onSettled: () => setBusy(null),
      },
    );
  };

  return (
    <View style={styles.invite}>
      <Pressable
        onPress={() => router.push({ pathname: "/community/[id]", params: { id: invite.community_id } })}
        accessibilityRole="button"
        accessibilityLabel={`${invite.inviter_display_name} invited you to ${invite.community_name}`}
        style={styles.inviteHead}
      >
        <CommunityAvatar id={invite.community_id} name={invite.community_name} imagePath={invite.community_image} size={44} />
        <View style={styles.flex}>
          <AppText variant="bodySemiBold" numberOfLines={1}>
            {invite.community_name}
          </AppText>
          <AppText variant="caption" color={Colors.text2} numberOfLines={1}>
            {invite.inviter_display_name} invited you · {invite.is_private ? "Private" : "Public"}
          </AppText>
        </View>
      </Pressable>
      <View style={styles.inviteActions}>
        <Button label="Accept" variant="action" size="sm" onPress={() => answer(true)} loading={busy === "accept"} disabled={busy !== null} style={styles.flex} />
        <Button label="Decline" variant="secondary" size="sm" onPress={() => answer(false)} loading={busy === "decline"} disabled={busy !== null} style={styles.flex} />
      </View>
    </View>
  );
}

/** A Discover card: image, PUBLIC / PRIVATE chip, name, description, members. */
function CommunityCardBase({ community }: { community: CommunitySummary }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/community/[id]", params: { id: community.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${community.name}, ${community.is_private ? "private, invite only" : "public"}, ${community.member_count} members`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <CommunityAvatar id={community.id} name={community.name} imagePath={community.image_path} size={56} />
      <View style={styles.flex}>
        <View style={styles.chipRow}>
          <PrivacyChip isPrivate={community.is_private} />
          {community.my_role ? <RoleChip role={community.my_role} /> : null}
        </View>
        <AppText variant="subheading" numberOfLines={1} style={styles.cardName}>
          {community.name}
        </AppText>
        {community.description ? (
          <AppText variant="caption" color={Colors.text2} numberOfLines={2}>
            {community.description}
          </AppText>
        ) : null}
        <AppText variant="caption" color={Colors.text3} style={styles.members}>
          {formatCount(community.member_count)} {community.member_count === 1 ? "member" : "members"}
        </AppText>
      </View>
    </Pressable>
  );
}
export const CommunityCard = memo(CommunityCardBase);

function SectionTitle({ children }: { children: string }) {
  return (
    <AppText variant="bodySemiBold" color={Colors.text2} style={styles.sectionTitle} accessibilityRole="header">
      {children}
    </AppText>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.lg, marginTop: Spacing.xs },
  section: { gap: Spacing.sm },
  flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.85 },
  create: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: "dashed",
  },
  createIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.cyan, alignItems: "center", justifyContent: "center" },
  sectionTitle: { fontFamily: FontFamily.semiBold },
  invite: { padding: Spacing.md, borderRadius: Radius.lg, backgroundColor: Colors.card, borderWidth: 1, borderColor: "rgba(255,215,0,0.25)", gap: Spacing.md },
  inviteHead: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  inviteActions: { flexDirection: "row", gap: Spacing.sm },
  mineList: { gap: Spacing.sm },
  mineRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md, padding: Spacing.sm, borderRadius: Radius.lg, backgroundColor: Colors.card },
  card: {
    flexDirection: "row",
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.hairline,
    marginBottom: Spacing.md,
  },
  chipRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  cardName: { marginTop: 6 },
  members: { marginTop: 6 },
});
