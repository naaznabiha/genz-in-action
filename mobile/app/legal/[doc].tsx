import { useLocalSearchParams } from "expo-router";
import { StyleSheet, View } from "react-native";

import AppText from "@/components/ui/app-text";
import Card from "@/components/ui/card";
import Screen from "@/components/ui/screen";
import ScreenHeader from "@/components/ui/screen-header";
import { Colors, Spacing } from "@/constants/theme";

const DOCS = {
  terms: { title: "Terms of Service" },
  privacy: { title: "Privacy Policy" },
} as const;

type DocId = keyof typeof DOCS;

/** Lets the static web export pre-render both documents (native ignores this). */
export function generateStaticParams(): { doc: DocId }[] {
  return [{ doc: "terms" }, { doc: "privacy" }];
}

/**
 * Terms of Service / Privacy Policy viewer (FR-02, FR-26).
 * TEMPORARY CONTENT: the final legal text, version and effective date must be
 * supplied before release (spec §18 "Terms / Privacy"). Until then this screen
 * says so plainly instead of showing invented legal terms.
 */
export default function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const id: DocId = doc === "privacy" ? "privacy" : "terms";
  const { title } = DOCS[id];

  return (
    <Screen scroll header={<ScreenHeader title={title} back />} edges={["top", "bottom"]}>
      <Card tone="accent">
        <View style={styles.body}>
          <AppText variant="subheading">Draft — not yet published</AppText>
          <AppText variant="body" color={Colors.text2}>
            The final {title} for GenZ in Action is being prepared and will be shown here, with its version and
            effective date, before the app is publicly released.
          </AppText>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: Spacing.md },
});
