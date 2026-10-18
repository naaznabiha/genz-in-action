import { Pressable, StyleSheet, View } from "react-native";

import AppText from "@/components/ui/app-text";
import { CategoryColors, Colors, FontFamily, Radius, type CategoryId } from "@/constants/theme";

/** Coloured cause/category label (prototype CategoryChip). */
export function CategoryChip({ category, small = false }: { category: CategoryId; small?: boolean }) {
  const c = CategoryColors[category];
  return (
    <View
      style={[
        styles.chip,
        { backgroundColor: c.bg, borderColor: c.border },
        small ? { paddingHorizontal: 8, paddingVertical: 2 } : { paddingHorizontal: 10, paddingVertical: 4 },
      ]}
    >
      <AppText style={{ fontFamily: FontFamily.semiBold, fontSize: small ? 10 : 12, lineHeight: small ? 14 : 16 }} color={c.text}>
        {c.label}
      </AppText>
    </View>
  );
}

type FilterChipProps = { label: string; selected: boolean; onPress: () => void };

/** Selectable filter pill (Home feed category filters, Create category picker). */
export function FilterChip({ label, selected, onPress }: FilterChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      hitSlop={{ top: 6, bottom: 6 }}
      style={[
        styles.filter,
        selected ? { backgroundColor: Colors.cyan, borderColor: Colors.cyan } : { backgroundColor: Colors.elevated, borderColor: Colors.border },
      ]}
    >
      <AppText style={styles.filterLabel} color={selected ? Colors.bg : Colors.text2}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { borderRadius: Radius.full, borderWidth: 1, alignSelf: "flex-start" },
  filter: { borderRadius: Radius.full, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 6 },
  filterLabel: { fontFamily: FontFamily.semiBold, fontSize: 12, lineHeight: 16 },
});
