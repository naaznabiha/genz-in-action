import { useRouter } from "expo-router";
import { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { AttachmentView } from "@/components/communities/community-bits";
import AppText from "@/components/ui/app-text";
import Avatar from "@/components/ui/avatar";
import { Colors, Radius, Spacing } from "@/constants/theme";
import { isEdited, relativeTime } from "@/lib/time";
import { avatarPublicUrl } from "@/services/profile";
import type { ContentItem } from "@/types/community";

/** A community content card (approved board "Content"): author, title, text, photo or PDF. */
function ContentCard({ item }: { item: ContentItem }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/community-content/[id]", params: { id: item.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, by ${item.author_display_name}${item.author_is_member ? "" : ", no longer a member"}`}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
    >
      <View style={styles.head}>
        <Avatar name={item.author_display_name} uri={avatarPublicUrl(item.author_avatar_path)} size={32} />
        <View style={styles.flex}>
          <AppText variant="bodySemiBold" numberOfLines={1}>
            {item.author_display_name}
          </AppText>
          <AppText variant="caption" color={Colors.text3} numberOfLines={1}>
            {item.author_is_member ? "" : "No longer a member · "}
            {relativeTime(item.created_at)}
            {isEdited(item.created_at, item.updated_at) ? " · Edited" : ""}
          </AppText>
        </View>
      </View>
      <AppText variant="subheading">{item.title}</AppText>
      {item.body ? (
        <AppText variant="body" color={Colors.text2} numberOfLines={3}>
          {item.body}
        </AppText>
      ) : null}
      {item.attachment ? <AttachmentView attachment={item.attachment} compact /> : null}
    </Pressable>
  );
}

export default memo(ContentCard);

const styles = StyleSheet.create({
  card: { padding: Spacing.lg, borderRadius: Radius.lg, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.hairline, gap: Spacing.sm },
  head: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  flex: { flex: 1, minWidth: 0 },
});
