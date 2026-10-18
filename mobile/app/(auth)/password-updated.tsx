import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { CheckIcon } from "@/components/icons";
import AppText from "@/components/ui/app-text";
import Button from "@/components/ui/button";
import Screen from "@/components/ui/screen";
import { Colors, Radius, Spacing } from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";

/** Password recovery done (prototype PasswordResetDoneScreen). */
export default function PasswordUpdatedScreen() {
  const router = useRouter();
  const { session, setRecoveringPassword, signOut } = useAuth();
  const { revoked } = useLocalSearchParams<{ revoked?: string }>();
  const [leaving, setLeaving] = useState(false);

  // Ending the recovery flag lets the root gate open the app with the current session.
  const continueToApp = () => setRecoveringPassword(false);

  const backToLogin = async () => {
    setLeaving(true);
    try {
      await signOut();
    } finally {
      router.replace("/login");
    }
  };

  return (
    <Screen edges={["top", "bottom"]} contentStyle={styles.content}>
      <View style={styles.center}>
        <View style={styles.badge}>
          <CheckIcon size={40} color={Colors.green} />
        </View>
        <AppText variant="display" align="center" accessibilityRole="header" style={styles.title}>
          Password updated
        </AppText>
        <AppText variant="body" color={Colors.text2} align="center" style={styles.subtitle}>
          Your password has been changed. You can jump straight back in, or log in fresh on this device.
        </AppText>

        <View style={styles.card}>
          <AppText style={styles.cardEmoji} accessible={false} importantForAccessibility="no">
            🔐
          </AppText>
          <AppText variant="caption" color={Colors.text2} style={styles.cardText}>
            {revoked === "1"
              ? "We signed you out everywhere else. If this reset was not you, contact support right away."
              : "We couldn't confirm that other devices were signed out. If this reset was not you, contact support right away."}
          </AppText>
        </View>
      </View>

      <View style={styles.actions}>
        {session ? <Button label="Continue to app" onPress={continueToApp} fullWidth /> : null}
        <Button label="Back to log in" onPress={backToLogin} variant="outline" loading={leaving} fullWidth />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.xxl },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  badge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(50,205,50,0.1)",
    borderWidth: 2,
    borderColor: "rgba(50,205,50,0.33)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xxl,
  },
  title: { marginBottom: Spacing.sm },
  subtitle: { maxWidth: 300, marginBottom: Spacing.xxl },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    alignSelf: "stretch",
    backgroundColor: Colors.card,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  cardEmoji: { fontSize: 20, lineHeight: 26 },
  cardText: { flex: 1 },
  actions: { gap: Spacing.md, paddingBottom: Spacing.xxl },
});
