import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_500Medium } from "@expo-google-fonts/inter/500Medium";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { Inter_700Bold } from "@expo-google-fonts/inter/700Bold";
import { PlusJakartaSans_700Bold } from "@expo-google-fonts/plus-jakarta-sans/700Bold";
import { PlusJakartaSans_800ExtraBold } from "@expo-google-fonts/plus-jakarta-sans/800ExtraBold";
import { DarkTheme, ThemeProvider, type Theme } from "@react-navigation/native";
import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import "react-native-reanimated";

import { ToastProvider } from "@/components/ui/toast";
import { Colors, FontFamily } from "@/constants/theme";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { queryClient } from "@/lib/query-client";

// Keep the native splash visible until fonts and the persisted session are ready,
// so the user never sees the wrong font or a flash of the wrong screen.
void SplashScreen.preventAutoHideAsync();

/** React Navigation theme built from the GenZ tokens so every navigator matches the design. */
const navigationTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Colors.cyan,
    background: Colors.bg,
    card: Colors.bg,
    text: Colors.text1,
    border: Colors.border,
    notification: Colors.red,
  },
};

/**
 * Session gate (spec §5.4). Expo Router's Stack.Protected removes screens whose
 * guard is false and redirects to the first available screen, so:
 *  - signed out (or mid password-reset) → (auth) group
 *  - signed in                          → (tabs) group
 * When the session ends (logout, revoked or expired token) the guard flips and
 * protected history is discarded, so no protected screen is left visible.
 */
function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const { isReady, isSignedIn } = useAuth();
  const ready = fontsReady && isReady;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.bg } }}>
      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={isSignedIn}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="settings/index" />
        <Stack.Screen name="settings/edit-profile" />
        <Stack.Screen name="settings/blocked-users" />
        <Stack.Screen name="settings/help" />
        <Stack.Screen name="settings/follow-requests" />
        <Stack.Screen name="post/[id]" />
        <Stack.Screen name="post/edit/[id]" />
        <Stack.Screen name="user/[id]" />
        <Stack.Screen name="search" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="dev/ui-kit" />
      </Stack.Protected>
      {/* Always reachable: Terms of Service / Privacy Policy (FR-02, FR-26). */}
      <Stack.Screen name="legal/[doc]" />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    [FontFamily.regular]: Inter_400Regular,
    [FontFamily.medium]: Inter_500Medium,
    [FontFamily.semiBold]: Inter_600SemiBold,
    [FontFamily.bold]: Inter_700Bold,
    [FontFamily.displayBold]: PlusJakartaSans_700Bold,
    [FontFamily.displayBlack]: PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    if (fontError) {
      // Fonts are bundled, so this should not happen; fall back to system fonts rather than block the app.
      console.warn("[fonts] Failed to load custom fonts, using system fonts.", fontError);
    }
  }, [fontError]);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider value={navigationTheme}>
          <ToastProvider>
            <RootNavigator fontsReady={fontsLoaded || Boolean(fontError)} />
          </ToastProvider>
          <StatusBar style="light" />
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
