import { useRouter } from "expo-router";
import { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import FollowButton from "@/components/social/follow-button";
import AppText from "@/components/ui/app-text";
import Avatar from "@/components/ui/avatar";
import { Colors, Spacing } from "@/constants/theme";
import { formatCount } from "@/lib/time";
import { avatarPublicUrl } from "@/services/profile";
import type { Relationship } from "@/types/social";

export type PersonRowData = {
  id: string;
  username: string;
  display_name: string;
  avatar_path: string | null;
  is_private: boolean;
  follower_count: number;
};

type PersonRowProps = {
  person: PersonRowData;
  /** From the server; suggestions are always "none". */
  relationship: Relationship;
  /** Optional second line under the username (e.g. "2 causes in common"). */
  note?: string;
  /** Called before navigating (Search uses it to remember the search). */
  onOpen?: () => void;
};

/** One person in a list (prototype UserRow): avatar, name, @username, followers, Follow button. */
function PersonRow({ person, relationship, note, onOpen }: PersonRowProps) {
  const router = useRouter();
  const open = () => {
    onOpen?.();
    if (relationship === "self") router.navigate("/profile");
    else router.push({ pathname: "/user/[id]", params: { id: person.id } });
  };
  const followers = `${formatCount(person.follower_count)} ${person.follower_count === 1 ? "follower" : "followers"}`;

  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={`${person.display_name}, @${person.username}${person.is_private ? ", private account" : ""}, ${followers}`}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Avatar name={person.display_name} uri={avatarPublicUrl(person.avatar_path)} size={44} />
      <View style={styles.text}>
        <View style={styles.nameRow}>
          <AppText variant="bodySemiBold" numberOfLines={1} style={styles.name}>
            {person.display_name}
          </AppText>
          {person.is_private ? (
            <AppText variant="caption" accessible={false}>
              🔒
            </AppText>
          ) : null}
        </View>
        <AppText variant="caption" color={Colors.text2} numberOfLines={1}>
          @{person.username} · {followers}
        </AppText>
        {note ? (
          <AppText variant="caption" color={Colors.cyan} numberOfLines={1}>
            {note}
          </AppText>
        ) : null}
      </View>
      {relationship === "self" ? (
        <AppText variant="caption" color={Colors.text3}>
          You
        </AppText>
      ) : (
        <FollowButton userId={person.id} username={person.username} relationship={relationship} isPrivate={person.is_private} size="sm" />
      )}
    </Pressable>
  );
}

export default memo(PersonRow);

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.md, paddingVertical: Spacing.md },
  pressed: { opacity: 0.8 },
  text: { flex: 1, minWidth: 0, gap: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { flexShrink: 1 },
});
