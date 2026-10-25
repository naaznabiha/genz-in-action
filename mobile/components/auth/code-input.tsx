import { useRef, useState, type ComponentRef } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import AppText from "@/components/ui/app-text";
import { Colors, FontFamily, Radius, Spacing } from "@/constants/theme";

type CodeInputProps = {
  value: string;
  onChange: (code: string) => void;
  length: number;
  /** Called once when the last digit is entered. */
  onComplete?: (code: string) => void;
  error?: string;
  disabled?: boolean;
};

/**
 * Six-box verification code input (prototype OTPScreen).
 * One hidden TextInput holds the value so paste and OS one-time-code
 * autofill work; the boxes are a visual rendering of it.
 */
export default function CodeInput({ value, onChange, length, onComplete, error, disabled }: CodeInputProps) {
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const [focused, setFocused] = useState(false);

  const handleChange = (text: string) => {
    const digits = text.replace(/\D/g, "").slice(0, length);
    onChange(digits);
    if (digits.length === length) onComplete?.(digits);
  };

  return (
    <View>
      <Pressable
        onPress={() => inputRef.current?.focus()}
        style={styles.row}
        accessible={false}
        disabled={disabled}
      >
        {Array.from({ length }, (_, i) => {
          const char = value[i] ?? "";
          const isCursor = focused && i === Math.min(value.length, length - 1);
          const borderColor = error ? Colors.red : char || isCursor ? Colors.cyan : Colors.border;
          return (
            <View key={i} style={[styles.box, { borderColor, borderWidth: char || isCursor ? 2 : 1 }]}>
              <AppText style={styles.digit}>{char}</AppText>
            </View>
          );
        })}
      </Pressable>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={length}
        editable={!disabled}
        autoFocus
        caretHidden
        accessibilityLabel={`${length}-digit verification code`}
        accessibilityHint={error}
        style={styles.hiddenInput}
      />
      {error ? (
        <AppText variant="caption" color={Colors.red} align="center" style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "center", gap: Spacing.sm },
  box: {
    width: 46,
    height: 56,
    borderRadius: Radius.md,
    backgroundColor: Colors.elevated,
    alignItems: "center",
    justifyContent: "center",
  },
  digit: { fontFamily: FontFamily.bold, fontSize: 20, lineHeight: 26 },
  // Kept in the layout (not display:none) so it can receive focus and autofill.
  hiddenInput: { position: "absolute", width: 1, height: 1, opacity: 0 },
  error: { marginTop: Spacing.md },
});
