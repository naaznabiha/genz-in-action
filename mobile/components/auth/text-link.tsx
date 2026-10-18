import { Pressable } from "react-native";

import AppText from "@/components/ui/app-text";
import { Colors, FontFamily } from "@/constants/theme";

type TextLinkProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  align?: "left" | "right" | "center";
};

/** Inline cyan text action ("Forgot password?", "Log in", "Resend code"). */
export default function TextLink({ label, onPress, disabled, align }: TextLinkProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={align === "right" ? { alignSelf: "flex-end" } : align === "center" ? { alignSelf: "center" } : undefined}
    >
      <AppText style={{ fontFamily: FontFamily.semiBold, opacity: disabled ? 0.5 : 1 }} color={Colors.cyan}>
        {label}
      </AppText>
    </Pressable>
  );
}
