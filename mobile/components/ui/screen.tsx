import type { ReactElement, ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type RefreshControlProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

import { Colors, Spacing } from "@/constants/theme";

type ScreenProps = {
  children: ReactNode;
  /** Wrap content in a ScrollView. Use FlatList-based screens with scroll={false}. */
  scroll?: boolean;
  /** Fixed header rendered above the scrolling body. */
  header?: ReactNode;
  /** Horizontal padding for the body (prototype uses px-5 = 20). */
  padded?: boolean;
  /** Tab screens sit above the tab bar, so they only need the top safe area. */
  edges?: Edge[];
  contentStyle?: StyleProp<ViewStyle>;
  /** Pull-to-refresh for scrolling screens (pass a <RefreshControl />). */
  refreshControl?: ReactElement<RefreshControlProps>;
};

/** Standard screen wrapper: safe areas, background, keyboard avoidance and optional scrolling. */
export default function Screen({
  children,
  scroll = false,
  header,
  padded = true,
  edges = ["top"],
  contentStyle,
  refreshControl,
}: ScreenProps) {
  const bodyStyle = [padded && styles.padded, contentStyle];
  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {header}
        {scroll ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[styles.scrollContent, bodyStyle]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            refreshControl={refreshControl}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.flex, bodyStyle]}>{children}</View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  flex: { flex: 1 },
  padded: { paddingHorizontal: Spacing.xl },
  scrollContent: { paddingBottom: Spacing.xxxl },
});
