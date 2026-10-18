import { Stack } from "expo-router";

import { Colors } from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";

/**
 * Unauthenticated flow (spec §5.1–5.3, milestone M1).
 * Screen order matters: the first available screen is where the root gate lands,
 * so first-time users see onboarding and everyone else sees welcome.
 * Onboarding is only available until it has been completed or skipped (FR-01).
 */
export default function AuthLayout() {
  const { hasOnboarded } = useAuth();

  return (
    <Stack
      initialRouteName={hasOnboarded ? "welcome" : "onboarding"}
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.bg }, animation: "slide_from_right" }}
    >
      <Stack.Protected guard={!hasOnboarded}>
        <Stack.Screen name="onboarding" options={{ animation: "fade" }} />
      </Stack.Protected>
      <Stack.Screen name="welcome" options={{ animation: "fade" }} />
      <Stack.Screen name="signup" />
      <Stack.Screen name="login" />
      <Stack.Screen name="verify-email" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="reset-code" />
      {/* Reached only with a recovery session; both screens handle a missing session. */}
      <Stack.Screen name="new-password" options={{ gestureEnabled: false }} />
      <Stack.Screen name="password-updated" options={{ gestureEnabled: false, animation: "fade" }} />
    </Stack>
  );
}
