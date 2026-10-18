import { Image } from "expo-image";
import { Pressable, StyleSheet, View } from "react-native";

import AppText from "@/components/ui/app-text";
import { Colors, FontFamily } from "@/constants/theme";

type AvatarProps = {
  uri?: string | null;
  /** Used for the initials fallback and the accessibility label. */
  name: string;
  size?: number;
  onPress?: () => void;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** Circular profile image with an initials fallback when there is no photo (or it fails to load). */
export default function Avatar({ uri, name, size = 36, onPress }: AvatarProps) {
  const circle = { width: size, height: size, borderRadius: size / 2 };
  const content = uri ? (
    <Image source={{ uri }} style={circle} contentFit="cover" transition={150} accessibilityIgnoresInvertColors />
  ) : (
    <View style={[styles.fallback, circle]}>
      <AppText style={{ fontFamily: FontFamily.displayBold, fontSize: size * 0.38, lineHeight: size * 0.46 }} color={Colors.cyan}>
        {initials(name)}
      </AppText>
    </View>
  );

  if (!onPress) {
    return (
      <View accessible accessibilityRole="image" accessibilityLabel={`${name}'s profile photo`}>
        {content}
      </View>
    );
  }
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Open ${name}'s profile`} hitSlop={4}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: Colors.elevated,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
});
