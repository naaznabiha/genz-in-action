import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { ArrowLeftIcon } from "@/components/icons";
import GenzLogo from "@/components/ui/genz-logo";
import IconButton from "@/components/ui/icon-button";
import { Colors, Spacing } from "@/constants/theme";

/** Back button + small logo mark used at the top of every auth form (prototype AuthFlow header). */
export default function AuthHeader({ onBack }: { onBack?: () => void }) {
  const router = useRouter();
  const handleBack = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace("/welcome")));
  return (
    <View style={styles.row}>
      <IconButton icon={<ArrowLeftIcon size={18} color={Colors.text1} />} onPress={handleBack} accessibilityLabel="Go back" />
      <GenzLogo size="xs" variant="mark" />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
});
