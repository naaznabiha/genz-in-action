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
import { useAuth } from "@/hooks/use-auth";
import { useCooldown } from "@/hooks/use-cooldown";
import { toReadableAuthError } from "@/lib/auth-errors";
import { EMAIL_CODE_LENGTH } from "@/lib/validation";
import { requestPasswordReset, verifyRecoveryCode } from "@/services/auth";

const RESEND_SECONDS = 60;

/**
 * Password recovery step 2: enter the emailed code (prototype OTPScreen).
 * Supabase signs the user in when the code is valid; the recovery flag keeps
 * them in the auth flow until a new password is set.
 */
export default function ResetCodeScreen() {
  const router = useRouter();
  const toast = useToast();
  const { setRecoveringPassword } = useAuth();
  const params = useLocalSearchParams<{ email?: string }>();
  const email = typeof params.email === "string" ? params.email : "";
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [verifying, setVerifying] = useState(false);
  const cooldown = useCooldown(RESEND_SECONDS);

  const verify = async (value: string) => {
    if (value.length !== EMAIL_CODE_LENGTH || verifying) return;
    setVerifying(true);
    setError(undefined);
    // Set BEFORE verifying so the root gate never flashes the app when the session appears.
    setRecoveringPassword(true);
    try {
      await verifyRecoveryCode(email, value);
      router.replace("/new-password");
    } catch (e) {
      setRecoveringPassword(false);
      setError(toReadableAuthError(e));
      setCode("");
    } finally {
      setVerifying(false);
    }
  };

  const resend = async () => {
    setError(undefined);
    try {
      await requestPasswordReset(email);
      cooldown.start(RESEND_SECONDS);
      toast.show("New code sent.", "info");
    } catch (e) {
      setError(toReadableAuthError(e));
    }
  };

  if (!email) {
    return (
      <Screen header={<AuthHeader />} edges={["top", "bottom"]} contentStyle={styles.content}>
        <AuthIntro title="Reset your password" subtitle="Start again by entering your email address." />
        <Button label="Enter email" onPress={() => router.replace("/forgot-password")} fullWidth />
      </Screen>
    );
  }

  return (
    <Screen scroll header={<AuthHeader />} edges={["top", "bottom"]} contentStyle={styles.content}>
      <AuthIntro
        emoji="📱"
        title="Check your email"
        subtitle={`If an account exists for ${email}, we sent a ${EMAIL_CODE_LENGTH}-digit code. Enter it below.`}
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
        label="Verify code"
        onPress={() => verify(code)}
        loading={verifying}
        disabled={code.length !== EMAIL_CODE_LENGTH}
        fullWidth
      />
      <View style={styles.resend}>
        <AppText variant="body" color={Colors.text2}>
          Did not receive it?
        </AppText>
        <TextLink
          label={cooldown.active ? `Resend in ${cooldown.remaining}s` : "Resend code"}
          onPress={resend}
          disabled={cooldown.active}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.xxl },
  status: { height: 40, alignItems: "center", justifyContent: "center" },
  resend: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: Spacing.xs, marginTop: Spacing.xl },
});
