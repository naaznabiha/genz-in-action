import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

import { Colors, Radius, Spacing } from "@/constants/theme";

type CardProps = {
  children: ReactNode;
  /** `hairline` = post/list cards; `accent` = cyan-tinted border used on dashboard cards. */
  tone?: "hairline" | "accent";
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function Card({ children, tone = "hairline", padded = true, style }: CardProps) {
  return (
    <View
      style={[
        {
          backgroundColor: Colors.card,
          borderRadius: Radius.lg,
          borderWidth: 1,
          borderColor: tone === "accent" ? Colors.border : Colors.hairline,
          overflow: "hidden",
        },
        padded && { padding: Spacing.lg },
        style,
      ]}
    >
      {children}
    </View>
  );
}
