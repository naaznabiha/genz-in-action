import { Pressable, StyleSheet, View } from "react-native";

import AppText from "@/components/ui/app-text";
import { CategoryColors, Colors, FontFamily, Radius, Spacing, type CategoryId } from "@/constants/theme";

/** The 8 causes (spec §8 catalogue, decision: keep the 8) with the prototype's emoji. */
export const CATEGORY_TILES: { id: CategoryId; emoji: string }[] = [
  { id: "climate", emoji: "🌊" },
  { id: "equality", emoji: "✊" },
  { id: "mental-health", emoji: "💙" },
  { id: "education", emoji: "📚" },
  { id: "housing", emoji: "🏠" },
  { id: "community", emoji: "🤝" },
  { id: "arts", emoji: "🎨" },
  { id: "tech", emoji: "💻" },
];

type CategoryGridProps = { selected: CategoryId | null; onSelect: (id: CategoryId | null) => void };

/** Explore → Discover "Browse by Category": 2-column tiles; tapping the selected tile clears it. */
export default function CategoryGrid({ selected, onSelect }: CategoryGridProps) {
  return (
    <View style={styles.grid}>
      {CATEGORY_TILES.map(({ id, emoji }) => {
        const c = CategoryColors[id];
        const active = selected === id;
        return (
          <Pressable
            key={id}
            onPress={() => onSelect(active ? null : id)}
            accessibilityRole="button"
            accessibilityLabel={`${c.label} posts`}
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [
              styles.tile,
              { backgroundColor: active ? c.bg : Colors.card, borderColor: active ? c.border : Colors.hairline },
              pressed && styles.pressed,
            ]}
          >
            <View style={[styles.icon, { backgroundColor: c.bg, borderColor: c.border }]}>
              <AppText style={styles.emoji} accessible={false}>
                {emoji}
              </AppText>
            </View>
            <AppText style={styles.label} color={c.text} numberOfLines={1}>
              {c.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  tile: {
    flexBasis: "48%",
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    minHeight: 64,
  },
  pressed: { opacity: 0.85 },
  icon: { width: 32, height: 32, borderRadius: Radius.md, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  emoji: { fontSize: 14, lineHeight: 18 },
  label: { fontFamily: FontFamily.semiBold, fontSize: 14, lineHeight: 18, flexShrink: 1 },
});
