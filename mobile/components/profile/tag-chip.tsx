import { Pressable, StyleSheet, View } from "react-native";

import { CheckIcon } from "@/components/icons";
import AppText from "@/components/ui/app-text";
import { CategoryColors, Colors, FontFamily, Radius, type CategoryId } from "@/constants/theme";

function palette(id: string) {
  // Seed tags reuse the prototype's category colours; any future tag falls back to cyan.
  return (CategoryColors as Record<string, (typeof CategoryColors)[CategoryId] | undefined>)[id] ?? {
    bg: Colors.cyanTint,
    text: Colors.cyan,
    border: Colors.border,
  };
}

type TagChipProps = {
  id: string;
  label: string;
  /** Selectable mode (Edit Profile picker). Omit for a read-only chip. */
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
};

/** Profile tag pill. Read-only on the profile; toggleable in Edit Profile. */
export default function TagChip({ id, label, selected, onPress, disabled }: TagChipProps) {
  const c = palette(id);
  const active = onPress ? Boolean(selected) : true;

  const style = [
    styles.chip,
    active
      ? { backgroundColor: c.bg, borderColor: c.border }
      : { backgroundColor: Colors.elevated, borderColor: Colors.border },
    disabled && !selected ? styles.disabled : null,
  ];
  const text = (
    <AppText style={styles.label} color={active ? c.text : Colors.text2}>
      {label}
    </AppText>
  );

  if (!onPress) {
    return (
      <View style={style} accessible accessibilityLabel={`Tag: ${label}`}>
        {text}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled && !selected}
      hitSlop={{ top: 4, bottom: 4 }}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: Boolean(selected), disabled: Boolean(disabled && !selected) }}
      style={({ pressed }) => [...style, pressed ? styles.pressed : null]}
    >
      {selected ? <CheckIcon size={12} color={c.text} /> : null}
      {text}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  label: { fontFamily: FontFamily.semiBold, fontSize: 12, lineHeight: 16 },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.8 },
});
