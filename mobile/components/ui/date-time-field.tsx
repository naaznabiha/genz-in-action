import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";

import { CalendarIcon, CloseIcon } from "@/components/icons";
import AppText from "@/components/ui/app-text";
import BottomSheet from "@/components/ui/bottom-sheet";
import Button from "@/components/ui/button";
import { Colors, Radius } from "@/constants/theme";
import { formatEventDate } from "@/lib/time";

export type DateTimeFieldProps = {
  label: string;
  value: Date | null;
  onChange: (value: Date | null) => void;
  minimumDate?: Date;
  error?: string;
};

/**
 * Native date + time picker (Android: system dialogs, iOS: a sheet with the
 * spinner). The web build uses date-time-field.web.tsx.
 */
export default function DateTimeField({ label, value, onChange, minimumDate, error }: DateTimeFieldProps) {
  const [iosOpen, setIosOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(value ?? defaultDate());

  const open = () => {
    if (Platform.OS === "android") {
      const start = value ?? defaultDate();
      DateTimePickerAndroid.open({
        value: start,
        mode: "date",
        minimumDate,
        onChange: (event: DateTimePickerEvent, date?: Date) => {
          if (event.type !== "set" || !date) return;
          DateTimePickerAndroid.open({
            value: date,
            mode: "time",
            is24Hour: true,
            onChange: (e2: DateTimePickerEvent, time?: Date) => {
              if (e2.type !== "set" || !time) return;
              const combined = new Date(date);
              combined.setHours(time.getHours(), time.getMinutes(), 0, 0);
              onChange(combined);
            },
          });
        },
      });
    } else {
      setDraft(value ?? defaultDate());
      setIosOpen(true);
    }
  };

  return (
    <View>
      <AppText variant="bodyMedium" color={Colors.text2} style={styles.label}>
        {label}
      </AppText>
      <View style={[styles.field, { borderColor: error ? Colors.red : Colors.border }]}>
        <Pressable onPress={open} style={styles.press} accessibilityRole="button" accessibilityLabel={`${label}: ${value ? formatEventDate(value.toISOString()) : "not set"}`}>
          <CalendarIcon size={16} color={Colors.text3} />
          <AppText variant="body" color={value ? Colors.text1 : Colors.text3}>
            {value ? formatEventDate(value.toISOString()) : "Pick a date and time"}
          </AppText>
        </Pressable>
        {value ? (
          <Pressable onPress={() => onChange(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear date" style={styles.clear}>
            <CloseIcon size={16} color={Colors.text3} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <AppText variant="caption" color={Colors.red} style={styles.error}>
          {error}
        </AppText>
      ) : null}

      {Platform.OS === "ios" ? (
        <BottomSheet visible={iosOpen} onClose={() => setIosOpen(false)} title={label}>
          <DateTimePicker
            value={draft}
            mode="datetime"
            display="spinner"
            minimumDate={minimumDate}
            themeVariant="dark"
            onChange={(_e, d) => d && setDraft(d)}
          />
          <Button
            label="Done"
            fullWidth
            onPress={() => {
              onChange(draft);
              setIosOpen(false);
            }}
          />
        </BottomSheet>
      ) : null}
    </View>
  );
}

function defaultDate() {
  const d = new Date(Date.now() + 24 * 3600 * 1000);
  d.setMinutes(0, 0, 0);
  return d;
}

const styles = StyleSheet.create({
  label: { marginBottom: 6 },
  field: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.elevated, borderWidth: 1, borderRadius: Radius.md, minHeight: 48 },
  press: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 14 },
  clear: { paddingHorizontal: 16 },
  error: { marginTop: 4 },
});
