import { StyleSheet, View } from "react-native";

import AppText from "@/components/ui/app-text";
import { Colors, Spacing } from "@/constants/theme";

type AuthIntroProps = { title: string; subtitle: string; emoji?: string };

/** Hero title block used on auth screens ("Welcome back", "Reset your password"…). */
export default function AuthIntro({ title, subtitle, emoji }: AuthIntroProps) {
  return (
    <View style={styles.wrap}>
      {emoji ? (
        <AppText style={styles.emoji} accessible={false} importantForAccessibility="no">
          {emoji}
        </AppText>
      ) : null}
      <AppText variant="display" accessibilityRole="header" style={styles.title}>
        {title}
      </AppText>
      <AppText variant="body" color={Colors.text2}>
        {subtitle}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: Spacing.xxxl },
  emoji: { fontSize: 48, lineHeight: 58, marginBottom: Spacing.xl },
  title: { marginBottom: Spacing.sm },
});
