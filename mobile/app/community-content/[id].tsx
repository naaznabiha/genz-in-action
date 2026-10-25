import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { AttachmentView } from "@/components/communities/community-bits";
import { DotsIcon } from "@/components/icons";
import AppText from "@/components/ui/app-text";
import Avatar from "@/components/ui/avatar";
import BottomSheet from "@/components/ui/bottom-sheet";
import Button from "@/components/ui/button";
import EmptyState from "@/components/ui/empty-state";
import Screen from "@/components/ui/screen";
import ScreenHeader from "@/components/ui/screen-header";
import { useToast } from "@/components/ui/toast";
import { Colors, Spacing } from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";
import { useCommunity, useContentItem, useDeleteContent } from "@/hooks/use-communities";
import { isEdited, relativeTime } from "@/lib/time";
import { avatarPublicUrl } from "@/services/profile";

/** One community content item. Its author, the owner and admins can delete it. */
export default function ContentItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const content = useContentItem(id);
  const item = content.data;
  const community = useCommunity(item?.community_id);
  const del = useDeleteContent(item?.community_id ?? "none");
  const [confirm, setConfirm] = useState(false);

  const canDelete = Boolean(item && (item.author_id === user?.id || community.data?.my_role === "owner" || community.data?.my_role === "admin"));

  if (content.isPending) {
    return (
      <Screen header={<ScreenHeader back />} edges={["top", "bottom"]}>
        <ActivityIndicator color={Colors.cyan} style={styles.loading} />
      </Screen>
    );
  }
  if (content.isError || !item) {
    return (
      <Screen header={<ScreenHeader back />} edges={["top", "bottom"]}>
        <EmptyState
          emoji={content.isError ? "⚠️" : "🫥"}
          title={content.isError ? "Couldn't load this" : "Not available"}
          subtitle={content.isError ? content.error.message : "It may have been deleted, or it belongs to a private community you're not in."}
          action={<Button label="Go back" variant="secondary" size="md" onPress={() => router.back()} />}
        />
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      edges={["top", "bottom"]}
      header={
        <ScreenHeader
          back
          title={community.data?.name}
          right={
            canDelete ? (
              <Pressable onPress={() => setConfirm(true)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Content options">
                <DotsIcon size={20} color={Colors.text2} />
              </Pressable>
            ) : undefined
          }
        />
      }
      contentStyle={styles.content}
    >
      <View style={styles.head}>
        <Avatar
          name={item.author_display_name}
          uri={avatarPublicUrl(item.author_avatar_path)}
          size={40}
          onPress={() => router.push({ pathname: "/user/[id]", params: { id: item.author_id } })}
        />
        <View style={styles.flex}>
          <AppText variant="bodySemiBold">{item.author_display_name}</AppText>
          <AppText variant="caption" color={Colors.text3}>
            {item.author_is_member ? "" : "No longer a member · "}
            {relativeTime(item.created_at)}
            {isEdited(item.created_at, item.updated_at) ? " · Edited" : ""}
          </AppText>
        </View>
      </View>
      <AppText variant="title" accessibilityRole="header">
        {item.title}
      </AppText>
      {item.attachment ? <AttachmentView attachment={item.attachment} /> : null}
      {item.body ? (
        <AppText variant="body" color={Colors.text2} selectable>
          {item.body}
        </AppText>
      ) : null}

      <BottomSheet
        visible={confirm}
        onClose={() => setConfirm(false)}
        title="Delete this content?"
        message={item.author_id === user?.id ? "It's removed from the community for everyone." : `This removes ${item.author_display_name}'s content for everyone.`}
      >
        <Button
          label="Delete"
          variant="danger"
          fullWidth
          loading={del.isPending}
          onPress={() =>
            del.mutate(item, {
              onSuccess: () => {
                setConfirm(false);
                toast.show("Deleted", "success");
                router.back();
              },
              onError: (e) => toast.show(e.message, "error"),
            })
          }
        />
        <Button label="Cancel" variant="secondary" fullWidth onPress={() => setConfirm(false)} />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: 80 },
  content: { gap: Spacing.lg, paddingTop: Spacing.sm },
  head: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  flex: { flex: 1, minWidth: 0 },
});
