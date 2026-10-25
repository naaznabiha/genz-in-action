import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import { FlatList, StyleSheet, View } from "react-native";

import { AttachmentView } from "@/components/communities/community-bits";
import ListFooter from "@/components/discovery/list-footer";
import AppText from "@/components/ui/app-text";
import Avatar from "@/components/ui/avatar";
import Button from "@/components/ui/button";
import EmptyState from "@/components/ui/empty-state";
import Screen from "@/components/ui/screen";
import ScreenHeader from "@/components/ui/screen-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { Colors, Radius, Spacing } from "@/constants/theme";
import { useCommunity, useStarred, useToggleStar } from "@/hooks/use-communities";
import { relativeTime } from "@/lib/time";
import { avatarPublicUrl } from "@/services/profile";
import type { StarredMessage } from "@/types/community";

/**
 * Your starred messages in one community (approved board "Starred"). Private
 * to you (D49): nobody else — not even admins — can see what you starred.
 */
export default function StarredScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const community = useCommunity(id);
  const isMember = Boolean(community.data?.my_role);
  const starred = useStarred(id, isMember);
  const toggle = useToggleStar(id);
  const items = useMemo(() => starred.data?.pages.flatMap((p) => p.messages) ?? [], [starred.data]);

  const unstar = useCallback(
    (m: StarredMessage) =>
      toggle.mutate(
        { messageId: m.id, starred: false },
        { onSuccess: () => toast.show("Removed from starred", "success"), onError: (e) => toast.show(e.message, "error") },
      ),
    [toast, toggle],
  );

  return (
    <Screen padded={false} header={<ScreenHeader back title="Starred" />} edges={["top", "bottom"]}>
      <FlatList<StarredMessage>
        data={items}
        keyExtractor={(m) => m.id}
        ListHeaderComponent={
          <AppText variant="caption" color={Colors.text3} style={styles.note}>
            ★ Only you can see your starred messages{community.data ? ` in ${community.data.name}` : ""}.
          </AppText>
        }
        renderItem={({ item: m }) => (
          <View style={styles.card}>
            <View style={styles.head}>
              <Avatar name={m.author_display_name} uri={avatarPublicUrl(m.author_avatar_path)} size={32} />
              <View style={styles.flex}>
                <AppText variant="bodySemiBold" numberOfLines={1}>
                  {m.author_display_name}
                </AppText>
                <AppText variant="caption" color={Colors.text3}>
                  {relativeTime(m.created_at)}
                  {m.pinned ? " · 📌 Pinned" : ""}
                </AppText>
              </View>
            </View>
            {m.attachment ? <AttachmentView attachment={m.attachment} compact /> : null}
            {m.body ? <AppText variant="body">{m.body}</AppText> : null}
            <View style={styles.actions}>
              <Button label="Unstar" variant="secondary" size="sm" onPress={() => unstar(m)} />
              <Button label="Show in discussion" variant="ghost" size="sm" onPress={() => router.push({ pathname: "/community/[id]/discussion", params: { id, focus: m.id } })} />
            </View>
          </View>
        )}
        ListEmptyComponent={
          starred.isPending && isMember ? (
            <View style={styles.skeletons}>
              <Skeleton height={96} radius={Radius.lg} />
              <Skeleton height={96} radius={Radius.lg} />
            </View>
          ) : starred.isError ? (
            <EmptyState emoji="⚠️" title="Couldn't load starred messages" subtitle={starred.error.message} action={<Button label="Try again" variant="secondary" size="md" onPress={() => void starred.refetch()} />} />
          ) : (
            <EmptyState emoji="⭐" title="Nothing starred yet" subtitle={isMember ? "Long-press a message in the discussion and choose Star to keep it here." : "Join the community to star messages."} />
          )
        }
        ListFooterComponent={
          <ListFooter
            isFetchingNextPage={starred.isFetchingNextPage}
            isFetchNextPageError={starred.isFetchNextPageError}
            hasNextPage={Boolean(starred.hasNextPage)}
            itemCount={items.length}
            onRetry={() => void starred.fetchNextPage()}
          />
        }
        onEndReached={() => {
          if (starred.hasNextPage && !starred.isFetchingNextPage) void starred.fetchNextPage();
        }}
        contentContainerStyle={styles.list}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxxl, gap: Spacing.md },
  note: { marginBottom: Spacing.md },
  card: { padding: Spacing.lg, borderRadius: Radius.lg, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.hairline, gap: Spacing.sm, marginBottom: Spacing.md },
  head: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  flex: { flex: 1, minWidth: 0 },
  actions: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.xs },
  skeletons: { gap: Spacing.md },
});
