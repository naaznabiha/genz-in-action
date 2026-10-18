import { StyleSheet, View } from "react-native";

import AppText from "@/components/ui/app-text";
import { Colors, FontFamily } from "@/constants/theme";

/** Red unread-count bubble. Counts above 99 show "99+". Renders nothing for 0. */
export default function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <View style={styles.badge} accessible={false} importantForAccessibility="no-hide-descendants">
      <AppText style={styles.text}>{count > 99 ? "99+" : String(count)}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: Colors.red,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { fontSize: 9, lineHeight: 12, fontFamily: FontFamily.bold, color: Colors.text1 },
});
