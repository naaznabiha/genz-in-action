import { useRouter } from "expo-router";
import { Pressable, StyleSheet } from "react-native";

import FollowButton from "@/components/social/follow-button";
import AppText from "@/components/ui/app-text";
import Avatar from "@/components/ui/avatar";
import { Colors, Radius, Spacing } from "@/constants/theme";
import { formatCount } from "@/lib/time";
import { avatarPublicUrl } from "@/services/profile";
import type { SuggestedPerson } from "@/types/social";

/** "People to Follow" card (prototype HomeScreen). Real accounts from get_suggested_people(). */
export default function PersonCard({ person }: { person: SuggestedPerson }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/user/[id]", params: { id: person.id } })}
      accessibilityRole="button"
      accessibilityLabel={`Open ${person.display_name}'s profile`}
      style={styles.card}
    >
      <Avatar name={person.display_name} uri={avatarPublicUrl(person.avatar_path)} size={48} />
      <AppText variant="captionSemiBold" numberOfLines={1} style={styles.name}>
        {person.display_name.split(" ")[0]}
      </AppText>
      <AppText style={styles.meta} color={Colors.text3} numberOfLines={1}>
        {formatCount(person.follower_count)} {person.follower_count === 1 ? "follower" : "followers"}
      </AppText>
      <FollowButton userId={person.id} username={person.username} relationship="none" isPrivate={person.is_private} size="sm" fullWidth />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 128,
    alignItems: "center",
    gap: 4,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  name: { marginTop: 4, maxWidth: "100%" },
  meta: { fontSize: 10, lineHeight: 14, marginBottom: 4 },
});
