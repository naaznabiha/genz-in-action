import { View } from "react-native";

import { Colors } from "@/constants/theme";

type ProgressBarProps = { value: number; max: number; color?: string; height?: number; accessibilityLabel?: string };

/** Thin rounded progress track (impact card, petition goal). Values are clamped to 0–100%. */
export default function ProgressBar({ value, max, color = Colors.cyanDim, height = 6, accessibilityLabel }: ProgressBarProps) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max, now: Math.min(value, max) }}
      style={{ height, borderRadius: height / 2, backgroundColor: Colors.elevated, overflow: "hidden" }}
    >
      <View style={{ width: `${pct}%`, height: "100%", borderRadius: height / 2, backgroundColor: color }} />
    </View>
  );
}
