import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import AppText from "@/components/ui/app-text";
import { Colors, FontFamily, MIN_TOUCH, Radius } from "@/constants/theme";

/**
 * Variants map to the two button families in the prototype:
 * - `primary`: bright cyan, dark label — auth/onboarding CTAs (AuthFlow.tsx GenzButton).
 * - `action`: teal (#00BFBF), white label — in-app actions (SharedUI.tsx Button "primary").
 * - `secondary`: elevated surface with hairline border.
 * - `outline`: transparent with cyan-tinted border ("I already have an account").
 * - `ghost`: text-only cyan.
 * - `destructive`: red on dark-red surface.
 */
export type ButtonVariant = "primary" | "action" | "secondary" | "outline" | "ghost" | "destructive";
export type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

const VARIANTS: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: Colors.cyan, fg: Colors.bg },
  action: { bg: Colors.cyanDim, fg: Colors.text1 },
  secondary: { bg: Colors.elevated, fg: Colors.text1, border: "rgba(255,255,255,0.12)" },
  outline: { bg: "transparent", fg: Colors.text2, border: Colors.border },
  ghost: { bg: "transparent", fg: Colors.cyan },
  destructive: { bg: Colors.redSurface, fg: Colors.red, border: "rgba(244,63,94,0.3)" },
};

const SIZES: Record<ButtonSize, { paddingVertical: number; paddingHorizontal: number; fontSize: number; radius: number }> = {
  sm: { paddingVertical: 8, paddingHorizontal: 16, fontSize: 14, radius: Radius.md },
  md: { paddingVertical: 14, paddingHorizontal: 20, fontSize: 14, radius: Radius.md },
  lg: { paddingVertical: 16, paddingHorizontal: 24, fontSize: 16, radius: Radius.lg },
};

export default function Button({
  label,
  onPress,
  variant = "primary",
  size = "lg",
  loading = false,
  disabled = false,
  fullWidth = false,
  leftIcon,
  accessibilityHint,
  style,
}: ButtonProps) {
  const v = VARIANTS[variant];
  const s = SIZES[size];
  const inactive = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      hitSlop={size === "sm" ? 6 : 0}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: v.bg,
          borderColor: v.border ?? "transparent",
          borderWidth: v.border ? 1 : 0,
          borderRadius: s.radius,
          paddingVertical: s.paddingVertical,
          paddingHorizontal: s.paddingHorizontal,
          opacity: inactive ? 0.6 : 1,
          transform: [{ scale: pressed && !inactive ? 0.97 : 1 }],
        },
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <View style={styles.content}>
          {leftIcon}
          <AppText style={{ fontFamily: FontFamily.bold, fontSize: s.fontSize, lineHeight: s.fontSize + 4 }} color={v.fg}>
            {label}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: MIN_TOUCH - 8, alignItems: "center", justifyContent: "center" },
  fullWidth: { alignSelf: "stretch" },
  content: { flexDirection: "row", alignItems: "center", gap: 8 },
});
