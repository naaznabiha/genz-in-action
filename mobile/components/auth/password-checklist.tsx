import { StyleSheet, View } from "react-native";

import { CheckIcon } from "@/components/icons";
import AppText from "@/components/ui/app-text";
import { Colors, FontFamily, Radius, Spacing } from "@/constants/theme";
import type { PasswordCheck } from "@/lib/validation";

/** "Password checklist" card from the prototype's NewPasswordScreen. */
export function PasswordChecklist({ checks }: { checks: PasswordCheck[] }) {
  return (
    <View style={styles.card}>
      <AppText style={styles.eyebrow} color={Colors.text3}>
        PASSWORD CHECKLIST
      </AppText>
      <View style={styles.list}>
        {checks.map((c) => (
          <View
            key={c.label}
            style={styles.item}
            accessible
            accessibilityLabel={`${c.label}: ${c.ok ? "done" : "not yet"}`}
          >
            <View style={[styles.dotWrap, { backgroundColor: c.ok ? "rgba(50,205,50,0.15)" : Colors.elevated }]}>
              {c.ok ? <CheckIcon size={10} color={Colors.green} /> : <View style={styles.dot} />}
            </View>
            <AppText variant="caption" color={c.ok ? Colors.green : Colors.text2}>
              {c.label}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

const STRENGTH = [
  { color: Colors.elevated, label: "" },
  { color: Colors.red, label: "Weak password" },
  { color: Colors.gold, label: "Good password" },
  { color: Colors.green, label: "Strong password" },
] as const;

/** Three-segment strength bar from the prototype's SignupScreen. */
export function PasswordStrengthMeter({ strength }: { strength: 0 | 1 | 2 | 3 }) {
  if (strength === 0) return null;
  const { color, label } = STRENGTH[strength];
  return (
    <View style={styles.meter} accessible accessibilityLabel={label}>
      <View style={styles.bars}>
        {[1, 2, 3].map((lvl) => (
          <View key={lvl} style={[styles.bar, { backgroundColor: strength >= lvl ? color : Colors.elevated }]} />
        ))}
      </View>
      <AppText variant="caption" color={color}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  eyebrow: { fontFamily: FontFamily.bold, fontSize: 10, lineHeight: 14, letterSpacing: 1, marginBottom: 10 },
  list: { gap: Spacing.sm },
  item: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  dotWrap: { width: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.text3 },
  meter: { marginTop: -Spacing.xxs, gap: Spacing.xs },
  bars: { flexDirection: "row", gap: Spacing.xs },
  bar: { flex: 1, height: 4, borderRadius: 2 },
});
