import { useState, type ReactNode, type Ref } from "react";
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from "react-native";

import { EyeIcon, EyeOffIcon } from "@/components/icons";
import AppText from "@/components/ui/app-text";
import { Colors, FontFamily, Radius } from "@/constants/theme";

type TextFieldProps = Omit<TextInputProps, "style"> & {
  label?: string;
  error?: string;
  helper?: string;
  /** Show a "12/160" counter under the field (requires maxLength). */
  showCount?: boolean;
  leftIcon?: ReactNode;
  rightAccessory?: ReactNode;
  ref?: Ref<TextInput>;
};

/**
 * Port of the prototype's GenzInput / Input / textarea fields.
 * Password fields (secureTextEntry) get a show/hide toggle automatically.
 */
export default function TextField({
  label,
  error,
  helper,
  showCount,
  leftIcon,
  rightAccessory,
  secureTextEntry,
  multiline,
  maxLength,
  value,
  ref,
  onFocus,
  onBlur,
  ...inputProps
}: TextFieldProps) {
  const [hidden, setHidden] = useState(Boolean(secureTextEntry));
  const [focused, setFocused] = useState(false);
  const hasRight = Boolean(secureTextEntry || rightAccessory);

  const borderColor = error ? Colors.red : focused ? Colors.cyanDim : Colors.border;

  return (
    <View style={styles.wrapper}>
      {label ? (
        <AppText variant="bodyMedium" color={Colors.text2} style={styles.label}>
          {label}
        </AppText>
      ) : null}
      <View style={[styles.field, { borderColor }, multiline && styles.multilineField]}>
        {leftIcon ? <View style={styles.left}>{leftIcon}</View> : null}
        <TextInput
          ref={ref}
          value={value}
          secureTextEntry={hidden}
          multiline={multiline}
          maxLength={maxLength}
          placeholderTextColor={Colors.text3}
          selectionColor={Colors.cyanDim}
          cursorColor={Colors.cyan}
          autoCorrect={false}
          autoCapitalize="none"
          accessibilityLabel={label ?? inputProps.placeholder}
          accessibilityHint={error}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            styles.input,
            leftIcon ? { paddingLeft: 44 } : null,
            hasRight ? { paddingRight: 48 } : null,
            multiline ? styles.multilineInput : null,
          ]}
          {...inputProps}
        />
        {secureTextEntry ? (
          <Pressable
            onPress={() => setHidden((prev) => !prev)}
            hitSlop={10}
            style={styles.right}
            accessibilityRole="button"
            accessibilityLabel={hidden ? "Show password" : "Hide password"}
          >
            {hidden ? <EyeIcon size={18} color={Colors.text3} /> : <EyeOffIcon size={18} color={Colors.text3} />}
          </Pressable>
        ) : rightAccessory ? (
          <View style={styles.right}>{rightAccessory}</View>
        ) : null}
      </View>
      <View style={styles.footer}>
        {error ? (
          <AppText variant="caption" color={Colors.red} style={styles.flex} accessibilityLiveRegion="polite">
            {error}
          </AppText>
        ) : helper ? (
          <AppText variant="caption" color={Colors.text3} style={styles.flex}>
            {helper}
          </AppText>
        ) : (
          <View style={styles.flex} />
        )}
        {showCount && maxLength ? (
          <AppText variant="caption" color={Colors.text3}>
            {(value ?? "").length}/{maxLength}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignSelf: "stretch" },
  label: { marginBottom: 6 },
  field: {
    backgroundColor: Colors.elevated,
    borderWidth: 1,
    borderRadius: Radius.md,
    justifyContent: "center",
  },
  multilineField: { justifyContent: "flex-start" },
  input: {
    color: Colors.text1,
    fontFamily: FontFamily.regular,
    fontSize: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 48,
  },
  multilineInput: { minHeight: 110, textAlignVertical: "top" },
  left: { position: "absolute", left: 16, zIndex: 1 },
  right: { position: "absolute", right: 16 },
  footer: { flexDirection: "row", marginTop: 4, gap: 8, minHeight: 4 },
  flex: { flex: 1 },
});
