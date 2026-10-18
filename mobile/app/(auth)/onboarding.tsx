import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AppText from "@/components/ui/app-text";
import GenzLogo from "@/components/ui/genz-logo";
import { Colors, Radius, Spacing } from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";

/** Copy and colours from the prototype's OnboardingScreen (AuthFlow.tsx). */
const SLIDES = [
  {
    emoji: "🧪",
    title: "Learn & Experiment",
    subtitle: "Explore real-world causes, test ideas, and build skills that matter for your generation.",
    color: Colors.cyan,
    bg: "#071828",
  },
  {
    emoji: "🛠️",
    title: "Build & Demo",
    subtitle: "Create projects, share your work, and showcase what Gen Z can do to the world.",
    color: Colors.gold,
    bg: "#1A1200",
  },
  {
    emoji: "🔄",
    title: "Improve & Repeat",
    subtitle: "Get feedback, level up your impact, and keep pushing until change actually happens.",
    color: Colors.green,
    bg: "#071A07",
  },
] as const;

/**
 * FR-01: Continue advances one slide; Skip bypasses the rest. Either way the
 * completion flag is persisted and the (auth) layout moves on to Welcome.
 */
export default function OnboardingScreen() {
  const { completeOnboarding } = useAuth();
  const [step, setStep] = useState(0);
  const slide = SLIDES[step];
  const isLast = step === SLIDES.length - 1;

  const finish = () => void completeOnboarding();

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.logo}>
        <GenzLogo size="sm" variant="mark" />
      </View>

      <View style={styles.body} accessibilityLiveRegion="polite">
        <View style={[styles.emojiBox, { backgroundColor: slide.bg, borderColor: `${slide.color}30` }]}>
          <AppText style={styles.emoji} accessible={false} importantForAccessibility="no">
            {slide.emoji}
          </AppText>
        </View>
        <AppText variant="display" align="center" accessibilityRole="header" style={styles.title}>
          {slide.title}
        </AppText>
        <AppText variant="body" color={Colors.text2} align="center" style={styles.subtitle}>
          {slide.subtitle}
        </AppText>
      </View>

      <View style={styles.footer}>
        <View style={styles.dots} accessible accessibilityLabel={`Slide ${step + 1} of ${SLIDES.length}`}>
          {SLIDES.map((s, i) => (
            <View
              key={s.title}
              style={[styles.dot, { width: i === step ? 28 : 8, backgroundColor: i === step ? slide.color : "rgba(0,200,200,0.2)" }]}
            />
          ))}
        </View>
        <Pressable
          onPress={() => (isLast ? finish() : setStep((s) => s + 1))}
          accessibilityRole="button"
          accessibilityLabel={isLast ? "Let's go" : "Continue"}
          style={({ pressed }) => [styles.cta, { backgroundColor: slide.color, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
        >
          <AppText variant="button" color={Colors.bg}>
            {isLast ? "Let's Go" : "Continue"}
          </AppText>
        </Pressable>
        {!isLast ? (
          <Pressable onPress={finish} accessibilityRole="button" accessibilityLabel="Skip onboarding" hitSlop={8} style={styles.skip}>
            <AppText variant="body" color={Colors.text3} align="center">
              Skip
            </AppText>
          </Pressable>
        ) : (
          <View style={styles.skipSpacer} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  logo: { alignItems: "center", paddingTop: Spacing.xxl, paddingBottom: Spacing.lg },
  body: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: Spacing.xxxl },
  emojiBox: {
    width: 112,
    height: 112,
    borderRadius: Radius.xl,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xxxl,
  },
  emoji: { fontSize: 56, lineHeight: 68 },
  title: { marginBottom: Spacing.lg },
  subtitle: { maxWidth: 300, fontSize: 16, lineHeight: 24 },
  footer: { paddingHorizontal: Spacing.xxl, paddingBottom: Spacing.xxl },
  dots: { flexDirection: "row", justifyContent: "center", gap: Spacing.sm, marginBottom: Spacing.xxxl },
  dot: { height: 6, borderRadius: 3 },
  cta: { paddingVertical: 16, borderRadius: Radius.lg, alignItems: "center", justifyContent: "center" },
  skip: { marginTop: Spacing.md, paddingVertical: Spacing.sm, minHeight: 36, justifyContent: "center" },
  skipSpacer: { height: 36 + Spacing.md },
});
