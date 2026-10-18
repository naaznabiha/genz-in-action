import { Pressable, StyleSheet, View } from "react-native";

import AppText from "@/components/ui/app-text";
import { Colors, FontFamily, Radius } from "@/constants/theme";

type Option<T extends string> = { value: T; label: string };

type SegmentedTabsProps<T extends string> = {
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  /** `teal` = in-app tabs (Saved/Liked, Explore). `cyan` = bright variant used in the Menu sub-screens. */
  tone?: "teal" | "cyan";
};

/** Pill-style segmented control (Explore Discover/Trending/People, Saved/Liked, Profile Actions/About). */
export default function SegmentedTabs<T extends string>({ options, value, onChange, tone = "teal" }: SegmentedTabsProps<T>) {
  const activeBg = tone === "teal" ? Colors.cyanDim : Colors.cyan;
  const activeFg = tone === "teal" ? Colors.text1 : Colors.bg;

  return (
    <View style={styles.row} accessibilityRole="tablist">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.tab, { backgroundColor: active ? activeBg : Colors.elevated }]}
          >
            <AppText style={styles.label} color={active ? activeFg : Colors.text2} numberOfLines={1}>
              {opt.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8 },
  tab: { flex: 1, minHeight: 40, paddingVertical: 10, borderRadius: Radius.md, alignItems: "center", justifyContent: "center" },
  label: { fontFamily: FontFamily.semiBold, fontSize: 14, lineHeight: 18 },
});
