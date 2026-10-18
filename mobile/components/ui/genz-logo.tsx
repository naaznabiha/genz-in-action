import { Image } from "expo-image";
import { View } from "react-native";

import AppText from "@/components/ui/app-text";
import { Colors, FontFamily } from "@/constants/theme";

const LOGO_MARK = require("@/assets/images/logo-mark.png");

const SIZE_MAP = {
  xs: { mark: 24, text: 11, gap: 6 },
  sm: { mark: 32, text: 13, gap: 8 },
  md: { mark: 40, text: 15, gap: 10 },
  lg: { mark: 56, text: 18, gap: 12 },
  xl: { mark: 80, text: 22, gap: 14 },
  "2xl": { mark: 140, text: 28, gap: 16 },
} as const;

type GenzLogoProps = {
  size?: keyof typeof SIZE_MAP;
  /** `mark` = image only, `full` = mark + wordmark side by side, `stacked` = mark above wordmark. */
  variant?: "mark" | "full" | "stacked";
};

/** Port of design-reference/src/components/GenzLogo.tsx. */
export default function GenzLogo({ size = "md", variant = "full" }: GenzLogoProps) {
  const s = SIZE_MAP[size];
  const mark = (
    <Image
      source={LOGO_MARK}
      style={{ width: s.mark, height: s.mark }}
      contentFit="contain"
      accessibilityLabel="GenZ in Action logo"
    />
  );

  if (variant === "mark") return mark;

  const stacked = variant === "stacked";
  const nameSize = stacked ? s.text * 1.2 : s.text;
  const tagSize = stacked ? s.text : s.text * 0.78;

  return (
    <View
      style={{ flexDirection: stacked ? "column" : "row", alignItems: "center", gap: stacked ? s.gap * 0.6 : s.gap }}
      accessible
      accessibilityLabel="GenZ in Action"
    >
      {mark}
      <View style={{ alignItems: stacked ? "center" : "flex-start" }}>
        <AppText style={{ fontFamily: FontFamily.displayBlack, fontSize: nameSize, lineHeight: nameSize * 1.15, letterSpacing: -0.3 }}>
          GenZ
        </AppText>
        <AppText
          color={Colors.cyan}
          style={{
            fontFamily: FontFamily.displayBold,
            fontSize: tagSize,
            lineHeight: tagSize * 1.15,
            letterSpacing: stacked ? 1.2 : 0.8,
            textTransform: "uppercase",
          }}
        >
          in Action
        </AppText>
      </View>
    </View>
  );
}
