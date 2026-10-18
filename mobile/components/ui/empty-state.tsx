import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import AppText from "@/components/ui/app-text";
import { Colors, Spacing } from "@/constants/theme";

type EmptyStateProps = {
  emoji: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
};

/** Centered empty / error / "all caught up" block (prototype EmptyState). */
export default function EmptyState({ emoji, title, subtitle, action }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <AppText style={styles.emoji} accessible={false}>
        {emoji}
      </AppText>
      <AppText variant="heading" align="center" accessibilityRole="header">
        {title}
      </AppText>
      {subtitle ? (
        <AppText variant="body" color={Colors.text2} align="center" style={styles.subtitle}>
          {subtitle}
        </AppText>
      ) : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", justifyContent: "center", paddingVertical: 64, paddingHorizontal: Spacing.xxxl },
  emoji: { fontSize: 48, lineHeight: 58, marginBottom: Spacing.lg },
  subtitle: { marginTop: Spacing.sm },
  action: { marginTop: Spacing.xxl },
});
