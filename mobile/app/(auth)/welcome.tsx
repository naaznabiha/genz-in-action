import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import LegalNotice from "@/components/auth/legal-notice";
import AppText from "@/components/ui/app-text";
import Button from "@/components/ui/button";
import GenzLogo from "@/components/ui/genz-logo";
import Screen from "@/components/ui/screen";
import { Colors, FontFamily, Radius, Spacing } from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";

const BANNER = require("@/assets/images/logo-banner.jpg");

/** Welcome / auth choice (FR-02, prototype AuthChoice). */
export default function WelcomeScreen() {
  const router = useRouter();
  const { isConfigured } = useAuth();

  return (
    <Screen scroll edges={["top", "bottom"]} contentStyle={styles.content}>
      <View style={styles.logo}>
        <GenzLogo size="xl" variant="mark" />
      </View>

      <View style={styles.card}>
        <Image source={BANNER} style={styles.banner} contentFit="contain" accessibilityLabel="GenZ in Action banner" />
        <View style={styles.cardBody}>
          <AppText variant="heading" style={styles.cardTitle}>
            GenZ in Action
          </AppText>
          <AppText variant="body" color={Colors.text2}>
            Learn, Experiment, Build, Demo, Improve and Repeat.
          </AppText>
        </View>
      </View>

      {!isConfigured && __DEV__ ? (
        <AppText variant="caption" color={Colors.gold} align="center" style={styles.warning}>
          Dev notice: Supabase is not configured (mobile/.env). Sign up and log in will fail.
        </AppText>
      ) : null}

      <View style={styles.actions}>
        <Button label="Create your account" onPress={() => router.push("/signup")} fullWidth />
        <Button label="I already have an account" onPress={() => router.push("/login")} variant="outline" fullWidth />
        <View style={styles.legal}>
          <LegalNotice />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: Spacing.xxl },
  logo: { alignItems: "center", paddingTop: Spacing.xxxl, paddingBottom: Spacing.xl },
  card: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
    marginBottom: Spacing.xxl,
    shadowColor: Colors.cyan,
    shadowOpacity: 0.12,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 0 },
  },
  banner: { width: "100%", height: 180, backgroundColor: Colors.bg },
  cardBody: { padding: Spacing.lg, backgroundColor: Colors.card },
  cardTitle: { fontFamily: FontFamily.displayBlack, marginBottom: Spacing.xs },
  warning: { marginBottom: Spacing.md },
  actions: { marginTop: "auto", gap: Spacing.md, paddingBottom: Spacing.xxl },
  legal: { marginTop: Spacing.xs },
});
