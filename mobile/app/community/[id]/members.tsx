import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { RoleChip } from "@/components/communities/community-bits";
import ListFooter from "@/components/discovery/list-footer";
import { DotsIcon, PlusIcon, SearchIcon } from "@/components/icons";
import AppText from "@/components/ui/app-text";
import Avatar from "@/components/ui/avatar";
import BottomSheet from "@/components/ui/bottom-sheet";
import Button from "@/components/ui/button";
import EmptyState from "@/components/ui/empty-state";
import Screen from "@/components/ui/screen";
import ScreenHeader from "@/components/ui/screen-header";
import TextField from "@/components/ui/text-field";
import { useToast } from "@/components/ui/toast";
import { Colors, FontFamily, Radius, Spacing } from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";
import {
  useCancelInvite,
  useCommunity,
  useCommunityMembers,
  useInvite,
  useLeaveCommunity,
  usePendingInvites,
  useRemoveMember,
  useSetMemberRole,
} from "@/hooks/use-communities";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useSearchProfiles } from "@/hooks/use-discovery";
import { relativeTime } from "@/lib/time";
import { avatarPublicUrl } from "@/services/profile";
import type { CommunityMember } from "@/types/community";

/**
 * Members (approved boards Members + InviteSheet). Owner first, then admins,
 * then members. Roles (D48): the owner appoints admins and hands over
 * ownership; owner and admins invite people and remove members (an admin
 * can't remove the owner or another admin). Leave is at the bottom; the owner
 * must choose a new owner first.
 */
export default function MembersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const community = useCommunity(id);
  const c = community.data;
  const canRead = Boolean(c?.can_read);
  const myRole = c?.my_role ?? null;
  const staff = myRole === "owner" || myRole === "admin";

  const members = useCommunityMembers(id, canRead);
  const invites = usePendingInvites(id, Boolean(myRole));
  const cancel = useCancelInvite();
  const setRole = useSetMemberRole(id);
  const remove = useRemoveMember(id);
  const leave = useLeaveCommunity();

  const [menuFor, setMenuFor] = useState<CommunityMember | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<CommunityMember | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);

  const list = useMemo(() => members.data?.pages.flatMap((p) => p.members) ?? [], [members.data]);

  if (c && !canRead) {
    return (
      <Screen header={<ScreenHeader back title="Members" />} edges={["top", "bottom"]}>
        <EmptyState emoji="🔒" title="Members only" subtitle="The member list of a private community is visible to its members only." />
      </Screen>
    );
  }

  const canManage = (m: CommunityMember) =>
    m.user_id !== user?.id && m.role !== "owner" && (myRole === "owner" || (myRole === "admin" && m.role === "member"));

  const onLeave = () => {
    if (!c) return;
    if (myRole === "owner") {
      router.push(`/community/${id}/transfer` as Href);
      return;
    }
    setLeaveOpen(true);
  };

  const header = (
    <View style={styles.header}>
      {staff ? <Button label="Invite people" variant="action" size="md" fullWidth leftIcon={<PlusIcon size={16} color={Colors.text1} />} onPress={() => setInviteOpen(true)} /> : null}
      {myRole && (invites.data?.length ?? 0) > 0 ? (
        <View style={styles.section}>
          <AppText style={styles.eyebrow} color={Colors.text3}>
            PENDING INVITES
          </AppText>
          {invites.data!.map((inv) => (
            <View key={inv.invite_id} style={styles.row}>
              <Avatar name={inv.invitee_display_name} uri={avatarPublicUrl(inv.invitee_avatar_path)} size={36} />
              <View style={styles.flex}>
                <AppText variant="bodySemiBold" numberOfLines={1}>
                  {inv.invitee_display_name}
                </AppText>
                <AppText variant="caption" color={Colors.text3} numberOfLines={1}>
                  Invited by {inv.inviter_id === user?.id ? "you" : inv.inviter_display_name} · {relativeTime(inv.created_at)}
                </AppText>
              </View>
              {staff || inv.inviter_id === user?.id ? (
                <Button
                  label="Cancel"
                  variant="ghost"
                  size="sm"
                  loading={cancel.isPending && cancel.variables === inv.invite_id}
                  onPress={() => cancel.mutate(inv.invite_id, { onSuccess: () => toast.show("Invite cancelled", "success"), onError: (e) => toast.show(e.message, "error") })}
                />
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
      <AppText style={styles.eyebrow} color={Colors.text3}>
        {c ? `${c.member_count} ${c.member_count === 1 ? "MEMBER" : "MEMBERS"}` : "MEMBERS"}
      </AppText>
    </View>
  );

  return (
    <Screen padded={false} header={<ScreenHeader back title="Members" />} edges={["top", "bottom"]}>
      <FlatList<CommunityMember>
        data={list}
        keyExtractor={(m) => m.user_id}
        ListHeaderComponent={header}
        renderItem={({ item: m }) => (
          <View style={styles.row}>
            <Avatar
              name={m.display_name}
              uri={avatarPublicUrl(m.avatar_path)}
              size={40}
              onPress={() => (m.user_id === user?.id ? router.navigate("/profile") : router.push({ pathname: "/user/[id]", params: { id: m.user_id } }))}
            />
            <View style={styles.flex}>
              <AppText variant="bodySemiBold" numberOfLines={1}>
                {m.display_name}
                {m.user_id === user?.id ? " (you)" : ""}
              </AppText>
              <AppText variant="caption" color={Colors.text3} numberOfLines={1}>
                @{m.username}
              </AppText>
            </View>
            <RoleChip role={m.role} />
            {canManage(m) ? (
              <Pressable onPress={() => setMenuFor(m)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Options for ${m.display_name}`} style={styles.dots}>
                <DotsIcon size={18} color={Colors.text2} />
              </Pressable>
            ) : (
              <View style={styles.dots} />
            )}
          </View>
        )}
        ListEmptyComponent={members.isPending || community.isPending ? <ActivityIndicator color={Colors.cyan} style={styles.loading} /> : members.isError ? <EmptyState emoji="⚠️" title="Couldn't load members" subtitle={members.error.message} /> : undefined}
        ListFooterComponent={
          <View>
            <ListFooter
              isFetchingNextPage={members.isFetchingNextPage}
              isFetchNextPageError={members.isFetchNextPageError}
              hasNextPage={Boolean(members.hasNextPage)}
              itemCount={list.length}
              onRetry={() => void members.fetchNextPage()}
            />
            {myRole ? <Button label="Leave community" variant="destructive" size="md" fullWidth onPress={onLeave} style={styles.leave} /> : null}
          </View>
        }
        onEndReached={() => {
          if (members.hasNextPage && !members.isFetchingNextPage) void members.fetchNextPage();
        }}
        contentContainerStyle={styles.list}
      />

      <BottomSheet visible={menuFor !== null} onClose={() => setMenuFor(null)} title={menuFor?.display_name ?? ""} message={menuFor ? `@${menuFor.username} · ${menuFor.role}` : undefined}>
        {menuFor && myRole === "owner" ? (
          <>
            <Button
              label={menuFor.role === "admin" ? "Remove admin role" : "Make admin"}
              variant="secondary"
              fullWidth
              loading={setRole.isPending}
              onPress={() => {
                const m = menuFor;
                setRole.mutate(
                  { userId: m.user_id, role: m.role === "admin" ? "member" : "admin" },
                  { onSuccess: () => toast.show(m.role === "admin" ? `${m.display_name} is now a member` : `${m.display_name} is now an admin`, "success"), onError: (e) => toast.show(e.message, "error") },
                );
                setMenuFor(null);
              }}
            />
            <Button
              label="Make owner"
              variant="secondary"
              fullWidth
              onPress={() => {
                const m = menuFor;
                setMenuFor(null);
                router.push({ pathname: "/community/[id]/transfer", params: { id, to: m.user_id } });
              }}
            />
          </>
        ) : null}
        {menuFor ? (
          <Button
            label="Remove from community"
            variant="destructive"
            fullWidth
            onPress={() => {
              setConfirmRemove(menuFor);
              setMenuFor(null);
            }}
          />
        ) : null}
      </BottomSheet>

      <BottomSheet
        visible={confirmRemove !== null}
        onClose={() => setConfirmRemove(null)}
        title={`Remove ${confirmRemove?.display_name ?? ""}?`}
        message="They lose access and can't rejoin by themselves. Their messages and content stay. You can invite them back later."
      >
        <Button
          label="Remove"
          variant="danger"
          fullWidth
          loading={remove.isPending}
          onPress={() =>
            confirmRemove &&
            remove.mutate(confirmRemove.user_id, {
              onSuccess: () => {
                toast.show(`${confirmRemove.display_name} was removed`, "success");
                setConfirmRemove(null);
              },
              onError: (e) => toast.show(e.message, "error"),
            })
          }
        />
        <Button label="Cancel" variant="secondary" fullWidth onPress={() => setConfirmRemove(null)} />
      </BottomSheet>

      <BottomSheet
        visible={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        title={`Leave ${c?.name ?? "community"}?`}
        message={c?.is_private ? "It's private: you'll need a new invite to come back. Your content stays." : "You can join again any time. Your content stays."}
      >
        <Button
          label="Leave community"
          variant="danger"
          fullWidth
          loading={leave.isPending}
          onPress={() =>
            leave.mutate(id, {
              onSuccess: () => {
                setLeaveOpen(false);
                toast.show("You left the community", "success");
                router.back();
              },
              onError: (e) => toast.show(e.message, "error"),
            })
          }
        />
        <Button label="Stay" variant="secondary" fullWidth onPress={() => setLeaveOpen(false)} />
      </BottomSheet>

      {staff ? <InviteSheet communityId={id} visible={inviteOpen} onClose={() => setInviteOpen(false)} memberIds={new Set(list.map((m) => m.user_id))} invitedIds={new Set((invites.data ?? []).map((i) => i.invitee_id))} /> : null}
    </Screen>
  );
}

/** Search people and invite them (approved board "InviteSheet"): Invite / Invited / Member. */
function InviteSheet({ communityId, visible, onClose, memberIds, invitedIds }: { communityId: string; visible: boolean; onClose: () => void; memberIds: Set<string>; invitedIds: Set<string> }) {
  const toast = useToast();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query.trim(), 300);
  const results = useSearchProfiles(debounced);
  const invite = useInvite(communityId);
  const [justInvited, setJustInvited] = useState<Set<string>>(new Set());
  const [alreadyMembers, setAlreadyMembers] = useState<Set<string>>(new Set());
  const people = (results.data?.pages.flatMap((p) => p.people) ?? []).filter((p) => p.id !== user?.id);

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Invite people">
      <TextField placeholder="Search by name or @username" value={query} onChangeText={setQuery} leftIcon={<SearchIcon size={16} color={Colors.text3} />} autoFocus />
      <ScrollView style={styles.results} keyboardShouldPersistTaps="handled">
        {debounced.length === 0 ? (
          <AppText variant="caption" color={Colors.text3} align="center">
            Invites go to people already on GenZ in Action. They&apos;ll get a notification.
          </AppText>
        ) : results.isPending ? (
          <ActivityIndicator color={Colors.cyan} />
        ) : people.length === 0 ? (
          <AppText variant="caption" color={Colors.text3} align="center">
            No one matches “{debounced}”.
          </AppText>
        ) : (
          people.map((p) => {
            const state = memberIds.has(p.id) || alreadyMembers.has(p.id) ? "member" : invitedIds.has(p.id) || justInvited.has(p.id) ? "invited" : "none";
            return (
              <View key={p.id} style={styles.row}>
                <Avatar name={p.display_name} uri={avatarPublicUrl(p.avatar_path)} size={36} />
                <View style={styles.flex}>
                  <AppText variant="bodySemiBold" numberOfLines={1}>
                    {p.display_name}
                  </AppText>
                  <AppText variant="caption" color={Colors.text3} numberOfLines={1}>
                    @{p.username}
                  </AppText>
                </View>
                {state === "none" ? (
                  <Button
                    label="Invite"
                    variant="action"
                    size="sm"
                    loading={invite.isPending && invite.variables === p.id}
                    onPress={() =>
                      invite.mutate(p.id, {
                        onSuccess: () => {
                          setJustInvited((s) => new Set(s).add(p.id));
                          toast.show(`Invited ${p.display_name}`, "success");
                        },
                        onError: (e) => {
                          if ((e as { rule?: string }).rule === "GENZ_ALREADY_MEMBER") setAlreadyMembers((s) => new Set(s).add(p.id));
                          toast.show(e.message, "error");
                        },
                      })
                    }
                  />
                ) : (
                  <AppText style={styles.state} color={state === "member" ? Colors.text3 : Colors.gold}>
                    {state === "member" ? "Member" : "Invited"}
                  </AppText>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
      <Button label="Done" variant="secondary" fullWidth onPress={onClose} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxxl },
  loading: { marginTop: 40 },
  header: { gap: Spacing.lg, marginBottom: Spacing.sm },
  section: { gap: Spacing.xs, padding: Spacing.md, borderRadius: Radius.lg, backgroundColor: Colors.card },
  eyebrow: { fontFamily: FontFamily.semiBold, fontSize: 11, lineHeight: 14, letterSpacing: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.md, paddingVertical: Spacing.sm },
  flex: { flex: 1, minWidth: 0 },
  dots: { width: 28, alignItems: "center" },
  leave: { marginTop: Spacing.xxl },
  results: { maxHeight: 320, marginVertical: Spacing.sm },
  state: { fontFamily: FontFamily.semiBold, fontSize: 12, lineHeight: 16, paddingHorizontal: Spacing.sm },
});
