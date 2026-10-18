import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import AuthHeader from "@/components/auth/auth-header";
import AuthIntro from "@/components/auth/auth-intro";
import CodeInput from "@/components/auth/code-input";
import TextLink from "@/components/auth/text-link";
import AppText from "@/components/ui/app-text";
import Button from "@/components/ui/button";
import Screen from "@/components/ui/screen";
import { useToast } from "@/components/ui/toast";
import { Colors, Spacing } from "@/constants/theme";
import { useCooldown } from "@/hooks/use-cooldown";
import { toReadableAuthError } from "@/lib/auth-errors";
import { EMAIL_CODE_LENGTH } from "@/lib/validation";
import { resendSignupCode, verifySignupCode } from "@/services/auth";

const RESEND_SECONDS = 60;

/**
 * Verification-pending state (spec §6.1, §11). The account exists but has no
 * session until the emailed code is entered. Success signs the user in and
 * the root gate opens the app.
 */
export default function VerifyEmailScreen() {
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ email?: string; fromLogin?: string }>();
  const email = typeof params.email === "string" ? params.email : "";
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  // A code was just sent by signUp() or by the login screen, so start on cooldown.
  const cooldown = useCooldown(RESEND_SECONDS);

  const verify = async (value: string) => {
    if (value.length !== EMAIL_CODE_LENGTH || verifying) return;
    setVerifying(true);
    setError(undefined);
    try {
      await verifySignupCode(email, value);
      toast.show("Email verified — welcome!", "success");
    } catch (e) {
      setError(toReadableAuthError(e));
      setCode("");
    } finally {
      setVerifying(false);
    }
  };

  const resend = async () => {
    setResending(true);
    setError(undefined);
    try {
      await resendSignupCode(email);
      cooldown.start(RESEND_SECONDS);
      toast.show("New code sent.", "info");
    } catch (e) {
      setError(toReadableAuthError(e));
    } finally {
      setResending(false);
    }
  };

  if (!email) {
    return (
      <Screen header={<AuthHeader />} edges={["top", "bottom"]} contentStyle={styles.content}>
        <AuthIntro title="Verify your email" subtitle="We couldn't tell which email to verify. Log in again to get a new code." />
        <Button label="Go to log in" onPress={() => router.replace("/login")} fullWidth />
      </Screen>
    );
  }

  return (
    <Screen scroll header={<AuthHeader />} edges={["top", "bottom"]} contentStyle={styles.content}>
      <AuthIntro
        emoji="📬"
        title="Check your email"
        subtitle={
          params.fromLogin
            ? `Your email isn't confirmed yet. Enter the ${EMAIL_CODE_LENGTH}-digit code we sent to ${email}.`
            : `Enter the ${EMAIL_CODE_LENGTH}-digit code we sent to ${email} to activate your account.`
        }
      />

      <CodeInput
        value={code}
        onChange={(v) => {
          setCode(v);
          setError(undefined);
        }}
        length={EMAIL_CODE_LENGTH}
        onComplete={verify}
        error={error}
        disabled={verifying}
      />

      <View style={styles.status}>{verifying ? <ActivityIndicator color={Colors.cyan} /> : null}</View>

      <Button
        label="Verify email"
        onPress={() => verify(code)}
        loading={verifying}
        disabled={code.length !== EMAIL_CODE_LENGTH}
        fullWidth
      />

      <View style={styles.resend}>
        <AppText variant="body" color={Colors.text2}>
          Didn&apos;t receive it?
        </AppText>
        <TextLink
          label={cooldown.active ? `Resend in ${cooldown.remaining}s` : resending ? "Sending…" : "Resend code"}
          onPress={resend}
          disabled={cooldown.active || resending}
        />
      </View>
      <AppText variant="caption" color={Colors.text3} align="center" style={styles.hint}>
        Check your spam folder. Wrong address? Go back and sign up again with the right email.
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.xxl },
  status: { height: 40, alignItems: "center", justifyContent: "center" },
  resend: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: Spacing.xs, marginTop: Spacing.xl },
  hint: { marginTop: Spacing.md },
});
