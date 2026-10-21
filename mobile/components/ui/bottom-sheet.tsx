import type { ReactNode } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AppText from "@/components/ui/app-text";
import { Colors, Radius, Spacing } from "@/constants/theme";

type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  message?: string;
  /** Usually one or two full-width Buttons. */
  children?: ReactNode;
  /** Prevent closing (backdrop / Android back) while an action is running. */
  dismissible?: boolean;
};

/**
 * Confirmation sheet sliding up from the bottom (prototype: Settings "Log out?",
 * Blocked Users "Unblock?"). Built on RN Modal so Android back closes it.
 */
export default function BottomSheet({ visible, onClose, title, message, children, dismissible = true }: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const close = () => {
    if (dismissible) onClose();
  };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityRole="button" accessibilityLabel="Close" />
        <View style={[styles.sheet, { paddingBottom: Spacing.xxl + insets.bottom }]} accessibilityViewIsModal>
          <View style={styles.handle} />
          <AppText variant="title" align="center" accessibilityRole="header">
            {title}
          </AppText>
          {message ? (
            <AppText variant="body" color={Colors.text2} align="center" style={styles.message}>
              {message}
            </AppText>
          ) : null}
          <View style={styles.actions}>{children}</View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end", backgroundColor: Colors.overlay },
  sheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.md,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginBottom: Spacing.lg,
  },
  message: { marginTop: Spacing.sm },
  actions: { marginTop: Spacing.xxl, gap: Spacing.md },
});
