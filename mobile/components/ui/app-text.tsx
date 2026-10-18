import { Text, type TextProps } from "react-native";

import { Colors, Typography, type TypographyVariant } from "@/constants/theme";

export type AppTextProps = TextProps & {
  variant?: TypographyVariant;
  color?: string;
  align?: "auto" | "left" | "right" | "center" | "justify";
};

/**
 * The only Text component screens should use, so fonts and the type scale stay consistent.
 * Font scaling stays on for accessibility but is capped to protect layouts.
 */
export default function AppText({
  variant = "body",
  color = Colors.text1,
  align,
  style,
  maxFontSizeMultiplier = 1.4,
  ...rest
}: AppTextProps) {
  return (
    <Text
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[Typography[variant], { color }, align ? { textAlign: align } : null, style]}
      {...rest}
    />
  );
}
