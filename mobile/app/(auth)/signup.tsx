import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import AuthHeader from "@/components/auth/auth-header";
import AuthIntro from "@/components/auth/auth-intro";
import LegalNotice from "@/components/auth/legal-notice";
import { PasswordStrengthMeter } from "@/components/auth/password-checklist";
import TextLink from "@/components/auth/text-link";
import { CheckIcon } from "@/components/icons";
import AppText from "@/components/ui/app-text";
import Button from "@/components/ui/button";
import Screen from "@/components/ui/screen";
import TextField from "@/components/ui/text-field";
import { useToast } from "@/components/ui/toast";
import { Colors, Spacing } from "@/constants/theme";
import { AuthFlowError } from "@/lib/auth-errors";
import {
  DISPLAY_NAME_MAX,
  USERNAME_MAX,
  normalizeUsername,
  passwordStrength,
  validateDisplayName,
  validateEmail,
  validatePassword,
  validateUsername,
} from "@/lib/validation";
import { isUsernameAvailable, signUpWithEmail } from "@/services/auth";

type Field = "name" | "username" | "email" | "password";
type Availability = "idle" | "checking" | "available" | "taken" | "unknown";

/** Sign up (spec §5.2, FR-03). Prototype: SignupScreen. */
export default function SignupScreen() {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [availability, setAvailability] = useState<Availability>("idle");

  // Debounced server-side availability check (FR / spec §6.1: validated server-side).
  useEffect(() => {
    if (validateUsername(username)) {
      setAvailability("idle");
      return;
    }
    setAvailability("checking");
    let cancelled = false;
    const id = setTimeout(() => {
      isUsernameAvailable(username)
        .then((ok) => !cancelled && setAvailability(ok ? "available" : "taken"))
        .catch(() => !cancelled && setAvailability("unknown"));
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [username]);

  const clearErrors = () => {
    setErrors({});
    setFormError(undefined);
  };

  const handleSubmit = async () => {
    const next: Partial<Record<Field, string>> = {
      name: validateDisplayName(name),
      username: validateUsername(username) ?? (availability === "taken" ? "That username is already taken." : undefined),
      email: validateEmail(email),
      password: validatePassword(password),
    };
    const failed = Object.fromEntries(Object.entries(next).filter(([, v]) => v)) as typeof next;
    if (Object.keys(failed).length) {
      setErrors(failed);
      return;
    }

    setLoading(true);
    clearErrors();
    try {
      const result = await signUpWithEmail({ email, password, displayName: name, username });
      if (result.needsEmailConfirmation) {
        router.replace({ pathname: "/verify-email", params: { email: email.trim() } });
      } else {
        // Email confirmation is off in Supabase: a session now exists and the root gate opens the app.
        toast.show("Welcome to GenZ in Action!", "success");
      }
    } catch (error) {
      const err = error instanceof AuthFlowError ? error : new AuthFlowError(String(error));
      if (err.code === "username_taken") {
        setAvailability("taken");
        setErrors({ username: err.message });
      } else if (err.code === "user_already_exists") {
        setErrors({ email: err.message });
      } else if (err.code === "weak_password") {
        setErrors({ password: err.message });
      } else {
        setFormError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const strength = passwordStrength(password);

  return (
    <Screen scroll header={<AuthHeader />} edges={["top", "bottom"]} contentStyle={styles.content}>
      <AuthIntro title="Join the movement" subtitle="Create your account to start making change." />

      <View style={styles.fields}>
        <TextField
          label="Full name"
          placeholder="Your Name"
          value={name}
          onChangeText={(t) => {
            setName(t);
            clearErrors();
          }}
          error={errors.name}
          maxLength={DISPLAY_NAME_MAX}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          returnKeyType="next"
        />
        <View>
          <TextField
            label="Username"
            placeholder="yourhandle"
            value={username}
            onChangeText={(t) => {
              setUsername(normalizeUsername(t));
              clearErrors();
            }}
            error={errors.username}
            maxLength={USERNAME_MAX}
            autoComplete="username-new"
            textContentType="username"
            leftIcon={<AppText color={Colors.text3}>@</AppText>}
          />
          {!errors.username ? <UsernameStatus username={username} availability={availability} /> : null}
        </View>
        <TextField
          label="Email"
          placeholder="you@example.com"
          value={email}
          onChangeText={(t) => {
            setEmail(t);
            clearErrors();
          }}
          error={errors.email}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
        />
        <View style={styles.passwordBlock}>
          <TextField
            label="Password"
            placeholder="Create a strong password"
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              clearErrors();
            }}
            error={errors.password}
            helper="8+ characters, with a number and an uppercase letter."
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
          />
          <PasswordStrengthMeter strength={strength} />
        </View>
      </View>

      {formError ? (
        <AppText variant="body" color={Colors.red} style={styles.formError} accessibilityLiveRegion="polite">
          {formError}
        </AppText>
      ) : null}

      <View style={styles.submit}>
        <Button label="Create Account" onPress={handleSubmit} loading={loading} fullWidth />
      </View>
      <LegalNotice prefix="By creating an account, you agree to our" />

      <View style={styles.footer}>
        <AppText variant="body" color={Colors.text2}>
          Already have an account?
        </AppText>
        <TextLink label="Log in" onPress={() => router.replace("/login")} />
      </View>
    </Screen>
  );
}

function UsernameStatus({ username, availability }: { username: string; availability: Availability }) {
  if (availability === "idle") return null;
  const map = {
    checking: { color: Colors.text3, text: "Checking availability…" },
    available: { color: Colors.green, text: `@${username} is available` },
    taken: { color: Colors.red, text: `@${username} is already taken` },
    unknown: { color: Colors.text3, text: "Couldn't check availability right now." },
  } as const;
  const { color, text } = map[availability];
  return (
    <View style={styles.status} accessible accessibilityLiveRegion="polite" accessibilityLabel={text}>
      {availability === "available" ? <CheckIcon size={12} color={color} /> : null}
      <AppText variant="caption" color={color}>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.xxl },
  fields: { gap: Spacing.md },
  passwordBlock: { gap: Spacing.xs },
  status: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, marginTop: -Spacing.xxs },
  formError: { marginTop: Spacing.lg },
  submit: { marginTop: Spacing.xxl, marginBottom: Spacing.md },
  footer: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: Spacing.xs, marginTop: Spacing.xl },
});
