import { StyleSheet, View } from "react-native";

import AppText from "@/components/ui/app-text";
import { Colors, FontFamily, Radius } from "@/constants/theme";

import type { DateTimeFieldProps } from "./date-time-field";

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Web build only: the browser's native datetime-local input (the RN picker has no web version). */
export default function DateTimeField({ label, value, onChange, minimumDate, error }: DateTimeFieldProps) {
  return (
    <View>
      <AppText variant="bodyMedium" color={Colors.text2} style={styles.label}>
        {label}
      </AppText>
      <input
        type="datetime-local"
        aria-label={label}
        value={value ? toLocalInput(value) : ""}
        min={minimumDate ? toLocalInput(minimumDate) : undefined}
        onChange={(e) => onChange(e.target.value ? new Date(e.target.value) : null)}
        style={{
          backgroundColor: Colors.elevated,
          color: Colors.text1,
          border: `1px solid ${error ? Colors.red : Colors.border}`,
          borderRadius: Radius.md,
          padding: "14px 16px",
          fontFamily: FontFamily.regular,
          fontSize: 14,
          colorScheme: "dark",
        }}
      />
      {error ? (
        <AppText variant="caption" color={Colors.red} style={styles.error}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: 6 },
  error: { marginTop: 4 },
});
