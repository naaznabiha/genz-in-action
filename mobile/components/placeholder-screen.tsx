import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import AppText from "@/components/ui/app-text";
import Button from "@/components/ui/button";
import GenzLogo from "@/components/ui/genz-logo";
import Screen from "@/components/ui/screen";
import { Colors, FontFamily, Radius, Spacing } from "@/constants/theme";

type PlaceholderScreenProps = {
  title: string;
  /** Which milestone replaces this placeholder, e.g. "Phase 2 — Profile and dashboard". */
  plannedFor: string;
};

/**
 * TEMPORARY — Phase 0 shell only.
 * Every screen using this component must be replaced by its real implementation.
 * Search the codebase for `PlaceholderScreen` to find what is still outstanding.
 */
export default function PlaceholderScreen({ title, plannedFor }: PlaceholderScreenProps) {
  const router = useRouter();
  return (
    <Screen>
      <View style={styles.container}>
        <GenzLogo size="xl" variant="stacked" />
        <AppText variant="display" style={styles.title} accessibilityRole="header">
          {title}
        </AppText>
        <View style={styles.badge}>
          <AppText style={styles.badgeText} color={Colors.gold}>
            PLACEHOLDER
          </AppText>
        </View>
        <AppText variant="body" color={Colors.text3} align="center">
          Built in {plannedFor}
        </AppText>
        {__DEV__ ? (
          <Button
            label="Open UI kit (dev only)"
            onPress={() => router.push("/dev/ui-kit")}
            variant="outline"
            size="md"
            style={styles.devButton}
          />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", gap: Spacing.md },
  title: { marginTop: Spacing.lg },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.gold,
  },
  badgeText: { fontFamily: FontFamily.bold, fontSize: 11, lineHeight: 14, letterSpacing: 1 },
  devButton: { marginTop: Spacing.xxl },
});
