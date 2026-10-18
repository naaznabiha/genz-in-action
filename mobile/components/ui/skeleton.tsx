import { useEffect } from "react";
import { StyleSheet, View, type DimensionValue } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import { Colors, Radius, Spacing } from "@/constants/theme";

type SkeletonProps = { width?: DimensionValue; height: number; radius?: number };

/**
 * Pulsing loading placeholder. The prototype used a CSS shimmer gradient;
 * an opacity pulse gives the same cue without a gradient mask dependency.
 */
export function Skeleton({ width = "100%", height, radius = 6 }: SkeletonProps) {
  const opacity = useSharedValue(0.5);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 750 }), -1, true);
  }, [opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: Colors.elevated }, style]} />;
}

/** Placeholder shaped like a PostCard (prototype SkeletonCard). */
export function SkeletonCard() {
  return (
    <View style={styles.card} accessibilityLabel="Loading" accessibilityRole="progressbar">
      <Skeleton height={170} radius={Radius.md} />
      <View style={styles.row}>
        <Skeleton width={32} height={32} radius={16} />
        <View style={styles.flex}>
          <Skeleton width="60%" height={12} />
          <View style={{ height: 6 }} />
          <Skeleton width="40%" height={10} />
        </View>
      </View>
      <Skeleton width="90%" height={14} />
      <View style={{ height: 8 }} />
      <Skeleton width="70%" height={14} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderColor: Colors.hairline,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  row: { flexDirection: "row", gap: Spacing.md, marginVertical: Spacing.lg },
  flex: { flex: 1 },
});
