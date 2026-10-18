import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { BackHandler, StyleSheet, View } from "react-native";

import AuthHeader from "@/components/auth/auth-header";
import AuthIntro from "@/components/auth/auth-intro";
import { PasswordChecklist } from "@/components/auth/password-checklist";
import AppText from "@/components/ui/app-text";
import Button from "@/components/ui/button";
import Screen from "@/components/ui/screen";
import TextField from "@/components/ui/text-field";
import { Colors, Spacing } from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";
import { AuthFlowError } from "@/lib/auth-errors";
import { passwordChecks } from "@/lib/validation";
import { updatePassword } from "@/services/auth";

/** Password recovery step 3 (prototype NewPasswordScreen). Requires the recovery session. */
export default function NewPasswordScreen() {
  const router = useRouter();
  const { session, signOut } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  const checks = [...passwordChecks(password), { label: "Passwords match", ok: password.length > 0 && password === confirm }];
  const allOk = checks.every((c) => c.ok);

  // Leaving this screen abandons the reset: end the recovery session rather than
  // leaving the user signed in without having chosen a password.
  const cancel = useCallback(() => {
    void signOut().finally(() => router.replace("/login"));
  }, [router, signOut]);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        cancel();
        return true;
      });
      return () => sub.remove();
    }, [cancel]),
  );

  const handleSubmit = async () => {
    if (!allOk) return;
    setLoading(true);
    setError(undefined);
    try {
      const { otherSessionsRevoked } = await updatePassword(password);
      router.replace({ pathname: "/password-updated", params: { revoked: otherSessionsRevoked ? "1" : "0" } });
    } catch (e) {
      setError(e instanceof AuthFlowError ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  if (!session) {
    return (
      <Screen header={<AuthHeader onBack={() => router.replace("/login")} />} edges={["top", "bottom"]} contentStyle={styles.content}>
        <AuthIntro title="Reset session ended" subtitle="Your password reset session has ended. Request a new code to try again." />
        <Button label="Request a new code" onPress={() => router.replace("/forgot-password")} fullWidth />
      </Screen>
    );
  }

  return (
    <Screen scroll header={<AuthHeader onBack={cancel} />} edges={["top", "bottom"]} contentStyle={styles.content}>
      <AuthIntro emoji="🛠️" title="Set a new password" subtitle="Code verified. Choose a password you have not used before." />

      <View style={styles.fields}>
        <TextField
          label="New password"
          placeholder="Create a strong password"
          value={password}
          onChangeText={(t) => {
            setPassword(t);
            setError(undefined);
          }}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
        />
        <TextField
          label="Confirm new password"
          placeholder="Repeat your password"
          value={confirm}
          onChangeText={(t) => {
            setConfirm(t);
            setError(undefined);
          }}
          error={confirm.length > 0 && confirm !== password ? "Passwords do not match" : undefined}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
        />
      </View>

      <View style={styles.checklist}>
        <PasswordChecklist checks={checks} />
      </View>

      {error ? (
        <AppText variant="body" color={Colors.red} style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}

      <Button label="Update Password" onPress={handleSubmit} loading={loading} disabled={!allOk} fullWidth style={styles.submit} />
      <AppText variant="caption" color={Colors.text3} align="center" style={styles.note}>
        Updating your password signs you out of all other devices.
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.xxl },
  fields: { gap: Spacing.md },
  checklist: { marginTop: Spacing.lg },
  error: { marginTop: Spacing.lg },
  submit: { marginTop: Spacing.xxl },
  note: { marginTop: Spacing.md },
});
