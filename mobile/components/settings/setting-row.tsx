import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { ChevronRightIcon } from "@/components/icons";
import AppText from "@/components/ui/app-text";
import Toggle from "@/components/ui/toggle";
import { Colors, FontFamily, MIN_TOUCH, Radius, Spacing } from "@/constants/theme";

type BaseProps = {
  icon: ReactNode;
  label: string;
  subtitle?: string;
  danger?: boolean;
};

type SettingRowProps =
  | (BaseProps & { kind: "link"; onPress: () => void })
  | (BaseProps & { kind: "toggle"; value: boolean; onValueChange: (next: boolean) => void; disabled?: boolean })
  /** Visible but not actionable: unsupported features are labelled instead of being dead buttons. */
  | (BaseProps & { kind: "soon" });

/** One row of the Settings list (prototype SettingsScreen SettingRow). */
export function SettingRow(props: SettingRowProps) {
  const { icon, label, subtitle, danger } = props;
  const soon = props.kind === "soon";
  const inner = (
    <>
      <View style={[styles.iconBox, { backgroundColor: danger ? Colors.redSurface : Colors.elevated }]}>{icon}</View>
      <View style={styles.text}>
        <AppText variant="bodySemiBold" color={danger ? Colors.red : soon ? Colors.text3 : Colors.text1}>
          {label}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" color={soon ? Colors.text3 : Colors.text2} style={styles.subtitle}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {props.kind === "toggle" ? (
        <Toggle value={props.value} onValueChange={props.onValueChange} accessibilityLabel={label} disabled={props.disabled} />
      ) : props.kind === "soon" ? (
        <View style={styles.soonPill}>
          <AppText style={styles.soonText} color={Colors.gold}>
            COMING SOON
          </AppText>
        </View>
      ) : (
        <ChevronRightIcon size={16} color={Colors.text3} />
      )}
    </>
  );

  if (props.kind === "link") {
    return (
      <Pressable
        onPress={props.onPress}
        accessibilityRole="button"
        accessibilityLabel={subtitle ? `${label}. ${subtitle}` : label}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        {inner}
      </Pressable>
    );
  }
  return (
    <View
      style={styles.row}
      accessible={soon}
      accessibilityLabel={soon ? `${label}, coming soon` : undefined}
      accessibilityState={soon ? { disabled: true } : undefined}
    >
      {inner}
    </View>
  );
}

/** Titled group of rows with hairline dividers (prototype settings section card). */
export function SettingSection({ title, footnote, children }: { title?: string; footnote?: string; children: ReactNode }) {
  const rows = Array.isArray(children) ? children.filter(Boolean) : [children];
  return (
    <View style={styles.section}>
      {title ? (
        <AppText style={styles.sectionTitle} color={Colors.text3} accessibilityRole="header">
          {title.toUpperCase()}
        </AppText>
      ) : null}
      <View style={styles.card}>
        {rows.map((row, i) => (
          <View key={i}>
            {i > 0 ? <View style={styles.divider} /> : null}
            {row}
          </View>
        ))}
      </View>
      {footnote ? (
        <AppText variant="caption" color={Colors.text3} style={styles.footnote}>
          {footnote}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: MIN_TOUCH + 16,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
  },
  pressed: { backgroundColor: "rgba(255,255,255,0.03)" },
  iconBox: { width: 36, height: 36, borderRadius: Radius.md, alignItems: "center", justifyContent: "center" },
  text: { flex: 1, minWidth: 0 },
  subtitle: { marginTop: 2 },
  soonPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.4)",
  },
  soonText: { fontFamily: FontFamily.bold, fontSize: 9, lineHeight: 12, letterSpacing: 0.6 },
  section: { marginBottom: Spacing.lg },
  sectionTitle: { fontFamily: FontFamily.semiBold, fontSize: 12, lineHeight: 16, letterSpacing: 1, marginBottom: Spacing.sm, paddingHorizontal: Spacing.xl },
  card: {
    marginHorizontal: Spacing.xl,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.hairline,
    overflow: "hidden",
  },
  divider: { height: 1, backgroundColor: Colors.divider, marginLeft: 72, marginRight: Spacing.xl },
  footnote: { marginTop: Spacing.sm, paddingHorizontal: Spacing.xxl },
});
