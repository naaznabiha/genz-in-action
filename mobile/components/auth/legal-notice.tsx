import { useRouter } from "expo-router";

import AppText from "@/components/ui/app-text";
import { Colors, FontFamily } from "@/constants/theme";

/** "By joining, you agree to our Terms of Service and Privacy Policy." with tappable links (FR-02). */
export default function LegalNotice({ prefix = "By joining, you agree to our" }: { prefix?: string }) {
  const router = useRouter();
  const link = { fontFamily: FontFamily.semiBold, color: Colors.text2, textDecorationLine: "underline" as const };
  return (
    <AppText variant="caption" color={Colors.text3} align="center">
      {prefix}{" "}
      <AppText
        variant="caption"
        style={link}
        onPress={() => router.push("/legal/terms")}
        accessibilityRole="link"
      >
        Terms of Service
      </AppText>{" "}
      and{" "}
      <AppText
        variant="caption"
        style={link}
        onPress={() => router.push("/legal/privacy")}
        accessibilityRole="link"
      >
        Privacy Policy
      </AppText>
      .
    </AppText>
  );
}
