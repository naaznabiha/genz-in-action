import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import AuthHeader from "@/components/auth/auth-header";
import AuthIntro from "@/components/auth/auth-intro";
import TextLink from "@/components/auth/text-link";
import AppText from "@/components/ui/app-text";
import Button from "@/components/ui/button";
import Screen from "@/components/ui/screen";
import TextField from "@/components/ui/text-field";
import { Colors, Spacing } from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";
import { AuthFlowError } from "@/lib/auth-errors";
import { validateEmail } from "@/lib/validation";
import { resendSignupCode, signInWithEmail } from "@/services/auth";

/** Log in (spec §5.3, FR-03). Prototype: LoginScreen. */
export default function LoginScreen() {
  const router = useRouter();
  const { setRecoveringPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string>();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const next = { email: validateEmail(email), password: password ? undefined : "Password is required" };
    if (next.email || next.password) {
      setErrors(next);
      return;
    }
    setLoading(true);
    setFormError(undefined);
    try {
      // Clears any abandoned password-reset state so the root gate opens the app.
      setRecoveringPassword(false);
      await signInWithEmail(email, password);
      // Success: onAuthStateChange stores the session and the root gate switches to the app.
    } catch (error) {
      const err = error instanceof AuthFlowError ? error : new AuthFlowError(String(error));
      if (err.code === "email_not_confirmed") {
        // Spec §6.1: never treat an unverified account as active — send them to verification.
        try {
          await resendSignupCode(email);
        } catch {
          // Rate limited or similar: the verify screen still lets them resend later.
        }
        router.push({ pathname: "/verify-email", params: { email: email.trim(), fromLogin: "1" } });
      } else {
        setFormError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const clear = () => {
    setErrors({});
    setFormError(undefined);
  };

  return (
    <Screen scroll header={<AuthHeader />} edges={["top", "bottom"]} contentStyle={styles.content}>
      <AuthIntro title="Welcome back" subtitle="Log in to continue making change." />

      <View style={styles.fields}>
        <TextField
          label="Email"
          placeholder="you@example.com"
          value={email}
          onChangeText={(t) => {
            setEmail(t);
            clear();
          }}
          error={errors.email}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
        />
        <TextField
          label="Password"
          placeholder="••••••••"
          value={password}
          onChangeText={(t) => {
            setPassword(t);
            clear();
          }}
          error={errors.password}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          onSubmitEditing={handleSubmit}
          returnKeyType="go"
        />
        <TextLink
          label="Forgot password?"
          align="right"
          onPress={() => router.push({ pathname: "/forgot-password", params: { email: email.trim() } })}
        />
      </View>

      {formError ? (
        <AppText variant="body" color={Colors.red} style={styles.formError} accessibilityLiveRegion="polite">
          {formError}
        </AppText>
      ) : null}

      <View style={styles.submit}>
        <Button label="Log In" onPress={handleSubmit} loading={loading} fullWidth />
      </View>
      <View style={styles.footer}>
        <AppText variant="body" color={Colors.text2}>
          New here?
        </AppText>
        <TextLink label="Create an account" onPress={() => router.replace("/signup")} />
      </View>

      <View style={styles.dividerRow}>
        <View style={styles.divider} />
        <AppText variant="caption" color={Colors.text3}>
          or continue with
        </AppText>
        <View style={styles.divider} />
      </View>

      {/* FR-05 / spec §6.1: providers are not configured yet, so these are shown disabled, not fake-functional. */}
      <View style={styles.providers}>
        <Button label="Continue with Google" onPress={() => {}} variant="secondary" size="md" disabled fullWidth />
        <Button label="Continue with Apple" onPress={() => {}} variant="secondary" size="md" disabled fullWidth />
        <AppText variant="caption" color={Colors.text3} align="center">
          Google and Apple sign-in are coming soon.
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.xxl },
  fields: { gap: Spacing.md },
  formError: { marginTop: Spacing.lg },
  submit: { marginTop: Spacing.xxl },
  footer: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: Spacing.xs, marginTop: Spacing.xl },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: Spacing.lg, marginVertical: Spacing.xxl },
  divider: { flex: 1, height: 1, backgroundColor: Colors.border },
  providers: { gap: Spacing.md },
});
