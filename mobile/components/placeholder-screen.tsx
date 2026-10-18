import { useRouter } from "expo-router";
import type { ReactNode } from "react";
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
  /** Optional real content shown under the placeholder notice (e.g. Phase 1 account card). */
  children?: ReactNode;
};

/**
 * TEMPORARY — shell screens only.
 * Every screen using this component must be replaced by its real implementation.
 * Search the codebase for `PlaceholderScreen` to find what is still outstanding.
 */
export default function PlaceholderScreen({ title, plannedFor, children }: PlaceholderScreenProps) {
  const router = useRouter();
  return (
    <Screen scroll contentStyle={styles.scroll}>
      <View style={styles.container}>
        <GenzLogo size="xl" variant="stacked" />
        <AppText variant="display" style={styles.title} align="center" accessibilityRole="header">
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
        {children ? <View style={styles.children}>{children}</View> : null}
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
  scroll: { flexGrow: 1, paddingBottom: 120 },
  container: { flex: 1, alignItems: "center", justifyContent: "center", gap: Spacing.md, paddingTop: Spacing.xxxl },
  title: { marginTop: Spacing.lg },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.gold,
  },
  badgeText: { fontFamily: FontFamily.bold, fontSize: 11, lineHeight: 14, letterSpacing: 1 },
  children: { alignSelf: "stretch", marginTop: Spacing.xl },
  devButton: { marginTop: Spacing.xxl },
});
