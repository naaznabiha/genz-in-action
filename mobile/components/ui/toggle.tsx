import { useEffect } from "react";
import { Pressable, StyleSheet } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { Colors } from "@/constants/theme";

type ToggleProps = {
  value: boolean;
  onValueChange: (next: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
};

const TRACK_W = 48;
const KNOB = 20;

/** Settings switch from the prototype (SettingsScreen.tsx Toggle). */
export default function Toggle({ value, onValueChange, accessibilityLabel, disabled }: ToggleProps) {
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(value ? 1 : 0, { duration: 180 });
  }, [value, progress]);

  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: 2 + progress.value * (TRACK_W - KNOB - 6) }],
  }));

  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      style={[
        styles.track,
        value ? styles.trackOn : styles.trackOff,
        disabled && { opacity: 0.5 },
      ]}
    >
      <Animated.View style={[styles.knob, knobStyle]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: { width: TRACK_W, height: 28, borderRadius: 14, justifyContent: "center" },
  trackOn: { backgroundColor: Colors.cyanDim },
  trackOff: { backgroundColor: Colors.elevated, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  knob: { width: KNOB, height: KNOB, borderRadius: KNOB / 2, backgroundColor: Colors.text1 },
});
