import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import Badge from "@/components/ui/badge";
import { Colors } from "@/constants/theme";

type IconButtonProps = {
  icon: ReactNode;
  onPress: () => void;
  /** Required: icon-only buttons have no visible text for screen readers. */
  accessibilityLabel: string;
  size?: number;
  badgeCount?: number;
  background?: string;
  disabled?: boolean;
};

/** Round icon button used in headers (search, bell, back, edit, settings). */
export default function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  size = 36,
  badgeCount,
  background = Colors.elevated,
  disabled,
}: IconButtonProps) {
  // Keep a 44pt touch target even when the visual circle is smaller.
  const slop = Math.max(0, (44 - size) / 2);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={slop}
      accessibilityRole="button"
      accessibilityLabel={badgeCount ? `${accessibilityLabel}, ${badgeCount} new` : accessibilityLabel}
      style={({ pressed }) => [
        styles.base,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: background, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      {icon}
      {badgeCount ? (
        <View style={styles.badge}>
          <Badge count={badgeCount} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", top: -3, right: -3 },
});
