import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet } from "react-native";

import AuthHeader from "@/components/auth/auth-header";
import AuthIntro from "@/components/auth/auth-intro";
import Button from "@/components/ui/button";
import Screen from "@/components/ui/screen";
import TextField from "@/components/ui/text-field";
import { Spacing } from "@/constants/theme";
import { toReadableAuthError } from "@/lib/auth-errors";
import { validateEmail } from "@/lib/validation";
import { requestPasswordReset } from "@/services/auth";

/** Password recovery step 1 (FR-04, decision D5). Prototype: ForgotScreen. */
export default function ForgotPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(typeof params.email === "string" ? params.email : "");
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const invalid = validateEmail(email);
    if (invalid) {
      setError(invalid);
      return;
    }
    setLoading(true);
    try {
      await requestPasswordReset(email);
      router.push({ pathname: "/reset-code", params: { email: email.trim() } });
    } catch (e) {
      setError(toReadableAuthError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll header={<AuthHeader />} edges={["top", "bottom"]} contentStyle={styles.content}>
      <AuthIntro
        emoji="🔑"
        title="Reset your password"
        subtitle="Enter your email and we will send you a verification code."
      />
      <TextField
        label="Email address"
        placeholder="you@example.com"
        value={email}
        onChangeText={(t) => {
          setEmail(t);
          setError(undefined);
        }}
        error={error}
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
        onSubmitEditing={handleSubmit}
        returnKeyType="send"
      />
      <Button label="Send Code" onPress={handleSubmit} loading={loading} fullWidth style={styles.submit} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.xxl },
  submit: { marginTop: Spacing.xxl },
});
