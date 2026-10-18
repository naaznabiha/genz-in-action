import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { ArrowLeftIcon } from "@/components/icons";
import AppText from "@/components/ui/app-text";
import IconButton from "@/components/ui/icon-button";
import { Colors, Spacing } from "@/constants/theme";

type ScreenHeaderProps = {
  title?: string;
  /** Pass `true` for default router.back(), a function for custom behaviour, or omit for no back button. */
  back?: boolean | (() => void);
  right?: ReactNode;
  titleColor?: string;
};

/** Port of the prototype's ScreenHeader / BackHeader. */
export default function ScreenHeader({ title, back, right, titleColor = Colors.text1 }: ScreenHeaderProps) {
  const router = useRouter();
  const onBack = typeof back === "function" ? back : () => router.back();

  return (
    <View style={styles.row}>
      {back ? (
        <IconButton icon={<ArrowLeftIcon size={18} color={Colors.text1} />} onPress={onBack} accessibilityLabel="Go back" />
      ) : null}
      {title ? (
        <AppText variant="title" color={titleColor} style={styles.title} accessibilityRole="header" numberOfLines={1}>
          {title}
        </AppText>
      ) : (
        <View style={styles.title} />
      )}
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  title: { flex: 1 },
});
