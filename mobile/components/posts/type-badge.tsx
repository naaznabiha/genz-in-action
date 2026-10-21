import { StyleSheet, View } from "react-native";

import AppText from "@/components/ui/app-text";
import { Colors, FontFamily, Radius } from "@/constants/theme";
import { postTypeMeta } from "@/types/post";

/** Post type pill (prototype TypeBadge): Take Action / Event / Petition / Story. */
export default function TypeBadge({ type }: { type: string }) {
  const meta = postTypeMeta(type);
  return (
    <View style={[styles.badge, { backgroundColor: meta.color }]}>
      <AppText style={styles.text} color={Colors.text1}>
        {meta.label.toUpperCase()}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2, alignSelf: "flex-start" },
  text: { fontFamily: FontFamily.bold, fontSize: 10, lineHeight: 14, letterSpacing: 0.6 },
});
