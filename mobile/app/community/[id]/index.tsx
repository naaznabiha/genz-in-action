import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, View } from "react-native";

import { CommunityAvatar, PrivacyChip, RoleChip } from "@/components/communities/community-bits";
import { ChatBubbleIcon, CheckIcon, ChevronRightIcon, EditIcon, ShareIcon, ShieldIcon } from "@/components/icons";
import AppText from "@/components/ui/app-text";
import BottomSheet from "@/components/ui/bottom-sheet";
import Button from "@/components/ui/button";
import EmptyState from "@/components/ui/empty-state";
import Screen from "@/components/ui/screen";
import ScreenHeader from "@/components/ui/screen-header";
import { useToast } from "@/components/ui/toast";
import { Colors, FontFamily, Radius, Spacing } from "@/constants/theme";
import { useCommunity, useDeleteCommunity, useJoinCommunity, useLeaveCommunity, useRespondToInvite, useStarred } from "@/hooks/use-communities";
import { shareCommunity } from "@/lib/share";
import { formatCount } from "@/lib/time";

/**
 * A community's page (approved boards DetailGuest / DetailInvited /
 * DetailMember). Everyone sees its identity (D47). Public communities can be
 * read by anyone and joined instantly; private ones only by members — an
 * invited person sees the invite banner and a "Members only" lock.
 */
export default function CommunityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const community = useCommunity(id);
  const c = community.data;
  const isMember = Boolean(c?.my_role);
  const starred = useStarred(id, isMember);
  const join = useJoinCommunity();
  const leave = useLeaveCommunity();
  const remove = useDeleteCommunity();
  const respond = useRespondToInvite();
  const [sheet, setSheet] = useState<null | "leave" | "delete">(null);
  const [refreshing, setRefreshing] = useState(false);

  if (community.isPending) {
    return (
      <Screen header={<ScreenHeader back />} edges={["top", "bottom"]}>
        <ActivityIndicator color={Colors.cyan} style={styles.loading} />
      </Screen>
    );
  }
  if (community.isError || !c) {
    return (
      <Screen header={<ScreenHeader back />} edges={["top", "bottom"]}>
        <EmptyState
          emoji={community.isError ? "⚠️" : "🫥"}
          title={community.isError ? "Couldn't load this community" : "Community not found"}
          subtitle={community.isError ? community.error.message : "It may have been deleted."}
          action={<Button label={community.isError ? "Try again" : "Go back"} variant="secondary" size="md" onPress={() => (community.isError ? void community.refetch() : router.back())} />}
        />
      </Screen>
    );
  }

  const staff = c.my_role === "owner" || c.my_role === "admin";
  const go = (path: "discussion" | "content" | "members" | "starred") => router.push(`/community/${c.id}/${path}` as Href);
  const starredCount = starred.data?.pages.reduce((n, p) => n + p.messages.length, 0) ?? 0;
  const joinedMonth = c.my_joined_at ? new Date(c.my_joined_at).toLocaleDateString(undefined, { month: "long" }) : null;

  const onJoin = () =>
    join.mutate(c.id, {
      onSuccess: () => toast.show(`Welcome to ${c.name}!`, "success"),
      onError: (e) => toast.show(e.message, "error"),
    });
  const onRespond = (accept: boolean) =>
    c.pending_invite_id &&
    respond.mutate(
      { inviteId: c.pending_invite_id, accept },
      { onSuccess: () => toast.show(accept ? `You joined ${c.name}` : "Invite declined", "success"), onError: (e) => toast.show(e.message, "error") },
    );
  const onShare = async () => {
    if (!(await shareCommunity(c))) toast.show("Sharing isn't available on this device.", "info");
  };
  const onMemberPress = () => {
    if (c.my_role === "owner") {
      if (c.member_count <= 1) setSheet("delete");
      else router.push(`/community/${c.id}/transfer` as Href);
    } else setSheet("leave");
  };
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.allSettled([community.refetch(), isMember ? starred.refetch() : Promise.resolve()]);
    setRefreshing(false);
  };

  return (
    <Screen
      scroll
      edges={["top", "bottom"]}
      header={
        <ScreenHeader
          back
          right={
            staff ? (
              <Pressable onPress={() => router.push({ pathname: "/community/create", params: { id: c.id } })} hitSlop={10} accessibilityRole="button" accessibilityLabel="Edit community">
                <EditIcon size={18} color={Colors.text2} />
              </Pressable>
            ) : undefined
          }
        />
      }
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.cyan} colors={[Colors.cyanDim]} />}
    >
      <View style={styles.hero}>
        <CommunityAvatar id={c.id} name={c.name} imagePath={c.image_path} size={88} />
        <View style={styles.chips}>
          <PrivacyChip isPrivate={c.is_private} />
          {c.my_role ? <RoleChip role={c.my_role} /> : null}
        </View>
        <AppText variant="title" align="center" accessibilityRole="header">
          {c.name}
        </AppText>
        <AppText variant="caption" color={Colors.text2} align="center">
          {formatCount(c.member_count)} {c.member_count === 1 ? "member" : "members"}
          {isMember && joinedMonth ? ` · you joined in ${joinedMonth}` : ""}
        </AppText>

        {c.pending_invite_id && !isMember ? (
          <View style={styles.inviteBanner}>
            <AppText variant="bodySemiBold" align="center">
              {c.invited_by_name ? `${c.invited_by_name} invited you to join` : "You're invited to join"}
            </AppText>
            <View style={styles.row}>
              <Button label="Accept" variant="action" size="md" onPress={() => onRespond(true)} loading={respond.isPending && respond.variables?.accept === true} disabled={respond.isPending} style={styles.flex} />
              <Button label="Decline" variant="secondary" size="md" onPress={() => onRespond(false)} loading={respond.isPending && respond.variables?.accept === false} disabled={respond.isPending} style={styles.flex} />
            </View>
          </View>
        ) : (
          <View style={styles.row}>
            {isMember ? (
              <Button label="Member" variant="secondary" size="md" leftIcon={<CheckIcon size={16} color={Colors.cyan} />} onPress={onMemberPress} style={styles.flex} accessibilityHint="Leave or hand over this community" />
            ) : c.is_private ? null : c.my_status === "removed" ? null : (
              <Button label="Join community" variant="action" size="md" onPress={onJoin} loading={join.isPending} style={styles.flex} />
            )}
            <Button label="Share" variant="outline" size="md" leftIcon={<ShareIcon size={16} color={Colors.text2} />} onPress={onShare} style={isMember || !c.is_private ? undefined : styles.flex} />
          </View>
        )}
        {!isMember && c.my_status === "removed" ? (
          <AppText variant="caption" color={Colors.text3} align="center">
            You were removed from this community. An admin can invite you back.
          </AppText>
        ) : null}
      </View>

      {c.can_read ? (
        <View style={styles.cards}>
          <LinkCard
            icon={<ChatBubbleIcon size={20} color={Colors.cyan} />}
            title="Discussion"
            subtitle={`Live chat${c.pinned_count ? ` · ${c.pinned_count} pinned ${c.pinned_count === 1 ? "message" : "messages"}` : ""}${c.messages_today ? ` · ${c.messages_today} today` : ""}`}
            onPress={() => go("discussion")}
          />
          <LinkCard icon={<AppText style={styles.cardEmoji}>📚</AppText>} title="Content" subtitle={`${c.content_count ?? 0} guides, photos, documents and posts`} onPress={() => go("content")} />
          <LinkCard icon={<AppText style={styles.cardEmoji}>👥</AppText>} title="Members" subtitle={`${formatCount(c.member_count)} · owner, admins and members`} onPress={() => go("members")} />
          {isMember ? (
            <LinkCard icon={<AppText style={styles.cardEmoji}>⭐</AppText>} title="Your starred messages" subtitle={`${starredCount}${starred.hasNextPage ? "+" : ""} · only you can see these`} onPress={() => go("starred")} />
          ) : null}
          {!isMember && !c.is_private ? (
            <AppText variant="caption" color={Colors.text3} align="center">
              You can read this public community. Join to post in the discussion and add content.
            </AppText>
          ) : null}
        </View>
      ) : (
        <View style={styles.locked}>
          <ShieldIcon size={28} color={Colors.gold} />
          <AppText variant="bodyBold" align="center">
            Members only
          </AppText>
          <AppText variant="caption" color={Colors.text2} align="center">
            {c.pending_invite_id
              ? "Accept the invite to read the discussion and content."
              : "This community is private. The discussion, content and members are visible to members only — ask an admin for an invite."}
          </AppText>
        </View>
      )}

      <View style={styles.about}>
        <AppText style={styles.eyebrow} color={Colors.text3}>
          ABOUT
        </AppText>
        <AppText variant="body" color={Colors.text2}>
          {c.description || "No description yet."}
        </AppText>
        {c.owner_display_name ? (
          <AppText variant="caption" color={Colors.text3}>
            Owner: {c.owner_display_name} · created {new Date(c.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
          </AppText>
        ) : null}
      </View>

      <BottomSheet visible={sheet === "leave"} onClose={() => setSheet(null)} title={`Leave ${c.name}?`} message={c.is_private ? "It's private: you'll need a new invite to come back. Your content stays." : "You can join again any time. Your content stays."}>
        <Button
          label="Leave community"
          variant="danger"
          fullWidth
          loading={leave.isPending}
          onPress={() =>
            leave.mutate(c.id, {
              onSuccess: () => {
                setSheet(null);
                toast.show(`You left ${c.name}`, "success");
              },
              onError: (e) => toast.show(e.message, "error"),
            })
          }
        />
        <Button label="Stay" variant="secondary" fullWidth onPress={() => setSheet(null)} />
      </BottomSheet>

      <BottomSheet visible={sheet === "delete"} onClose={() => setSheet(null)} title={`Delete ${c.name}?`} message="You're the only member, so you can delete it. Its discussion, content and community posts are removed for good.">
        <Button
          label="Delete community"
          variant="danger"
          fullWidth
          loading={remove.isPending}
          onPress={() =>
            remove.mutate(c.id, {
              onSuccess: () => {
                setSheet(null);
                toast.show("Community deleted", "success");
                router.back();
              },
              onError: (e) => toast.show(e.message, "error"),
            })
          }
        />
        <Button label="Keep it" variant="secondary" fullWidth onPress={() => setSheet(null)} />
      </BottomSheet>
    </Screen>
  );
}

function LinkCard({ icon, title, subtitle, onPress }: { icon: ReactNode; title: string; subtitle: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title}. ${subtitle}`} style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}>
      <View style={styles.cardIcon}>{icon}</View>
      <View style={styles.flex}>
        <AppText variant="bodyBold">{title}</AppText>
        <AppText variant="caption" color={Colors.text2} numberOfLines={1}>
          {subtitle}
        </AppText>
      </View>
      <ChevronRightIcon size={18} color={Colors.text3} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: 80 },
  hero: { alignItems: "center", gap: Spacing.sm, paddingVertical: Spacing.lg },
  chips: { flexDirection: "row", gap: 6, marginTop: Spacing.xs },
  row: { flexDirection: "row", gap: Spacing.sm, alignSelf: "stretch", marginTop: Spacing.md },
  flex: { flex: 1, minWidth: 0 },
  inviteBanner: { alignSelf: "stretch", marginTop: Spacing.md, padding: Spacing.lg, borderRadius: Radius.lg, backgroundColor: "rgba(255,215,0,0.07)", borderWidth: 1, borderColor: "rgba(255,215,0,0.3)" },
  cards: { gap: Spacing.sm, marginTop: Spacing.sm },
  card: { flexDirection: "row", alignItems: "center", gap: Spacing.md, padding: Spacing.lg, borderRadius: Radius.lg, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.hairline },
  cardIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.elevated, alignItems: "center", justifyContent: "center" },
  cardEmoji: { fontSize: 18, lineHeight: 22 },
  locked: { alignItems: "center", gap: Spacing.sm, padding: Spacing.xxl, borderRadius: Radius.lg, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.hairline, marginTop: Spacing.sm },
  about: { gap: Spacing.sm, marginTop: Spacing.xxl },
  eyebrow: { fontFamily: FontFamily.semiBold, fontSize: 11, lineHeight: 14, letterSpacing: 1 },
});
