import { useRouter } from "expo-router";
import { useState } from "react";
import { LayoutAnimation, Pressable, StyleSheet, View } from "react-native";

import { ChevronRightIcon } from "@/components/icons";
import AppText from "@/components/ui/app-text";
import Card from "@/components/ui/card";
import Screen from "@/components/ui/screen";
import ScreenHeader from "@/components/ui/screen-header";
import { Colors, Spacing } from "@/constants/theme";

/**
 * Help & FAQ (spec FR-26). The project has no help content yet, so these
 * answers describe only what the app does today. Expand alongside each phase;
 * add a support contact once one exists (none is defined — not invented here).
 */
const FAQ: { q: string; a: string }[] = [
  {
    q: "How do I change my name, username, bio or tags?",
    a: "Go to Profile → Edit Profile (or Settings → Edit Profile), make your changes and tap Save. Save only lights up once you've changed something valid.",
  },
  {
    q: "Why can't I use a username I want?",
    a: "Usernames are unique regardless of capital letters, and use 3–30 lowercase letters, numbers or underscores. If someone already has it, you'll see a message and can pick another.",
  },
  {
    q: "How do I change my profile photo?",
    a: "In Edit Profile, tap your photo or Change Photo and pick a picture from your gallery. It's cropped to a square and uploaded when you tap Save. JPEG and PNG photos up to 5 MB are supported.",
  },
  {
    q: "How many tags can I add?",
    a: "Up to five. Tags show on your profile so people can see the causes you care about.",
  },
  {
    q: "What does Private Account do?",
    a: "A private account will require your approval before someone can follow you and see your posts. Following launches in an upcoming update; your setting is saved now and applies then.",
  },
  {
    q: "How is my impact calculated?",
    a: "Impact is calculated on our servers from the actions you take in the app. Scoring is still being finalised, so your dashboard shows a getting-started state until it goes live. Points can't be added or edited by hand.",
  },
  {
    q: "I forgot my password.",
    a: "Log out, then on the Log in screen tap Forgot password? We'll email you a 6-digit code to set a new password.",
  },
  {
    q: "How do I log out?",
    a: "Settings → Log Out, then confirm. You'll return to the welcome screen.",
  },
];

export default function HelpScreen() {
  const router = useRouter();
  const [open, setOpen] = useState<number | null>(0);

  const toggle = (i: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((prev) => (prev === i ? null : i));
  };

  return (
    <Screen scroll header={<ScreenHeader title="Help & FAQ" back />} edges={["top", "bottom"]} contentStyle={styles.content}>
      <Card padded={false}>
        {FAQ.map((item, i) => {
          const expanded = open === i;
          return (
            <View key={item.q}>
              {i > 0 ? <View style={styles.divider} /> : null}
              <Pressable
                onPress={() => toggle(i)}
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                style={styles.question}
              >
                <AppText variant="bodySemiBold" style={styles.flex}>
                  {item.q}
                </AppText>
                <View style={{ transform: [{ rotate: expanded ? "90deg" : "0deg" }] }}>
                  <ChevronRightIcon size={16} color={Colors.text3} />
                </View>
              </Pressable>
              {expanded ? (
                <AppText variant="body" color={Colors.text2} style={styles.answer}>
                  {item.a}
                </AppText>
              ) : null}
            </View>
          );
        })}
      </Card>

      <AppText variant="caption" color={Colors.text3} align="center" style={styles.footer}>
        See also our{" "}
        <AppText variant="caption" color={Colors.text2} style={styles.link} onPress={() => router.push("/legal/terms")} accessibilityRole="link">
          Terms of Service
        </AppText>{" "}
        and{" "}
        <AppText variant="caption" color={Colors.text2} style={styles.link} onPress={() => router.push("/legal/privacy")} accessibilityRole="link">
          Privacy Policy
        </AppText>
        .
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: Spacing.sm, gap: Spacing.lg },
  divider: { height: 1, backgroundColor: Colors.divider },
  question: { flexDirection: "row", alignItems: "center", gap: Spacing.md, padding: Spacing.lg, minHeight: 56 },
  flex: { flex: 1 },
  answer: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },
  footer: { marginTop: Spacing.sm },
  link: { textDecorationLine: "underline" },
});
