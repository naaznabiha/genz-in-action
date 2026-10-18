import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_500Medium } from "@expo-google-fonts/inter/500Medium";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { Inter_700Bold } from "@expo-google-fonts/inter/700Bold";
import { PlusJakartaSans_700Bold } from "@expo-google-fonts/plus-jakarta-sans/700Bold";
import { PlusJakartaSans_800ExtraBold } from "@expo-google-fonts/plus-jakarta-sans/800ExtraBold";
import { DarkTheme, ThemeProvider, type Theme } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import "react-native-reanimated";

import { ToastProvider } from "@/components/ui/toast";
import { Colors, FontFamily } from "@/constants/theme";

// Keep the native splash visible until fonts are ready, so text never flashes in the wrong font.
void SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: "(tabs)",
};

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

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    [FontFamily.regular]: Inter_400Regular,
    [FontFamily.medium]: Inter_500Medium,
    [FontFamily.semiBold]: Inter_600SemiBold,
    [FontFamily.bold]: Inter_700Bold,
    [FontFamily.displayBold]: PlusJakartaSans_700Bold,
    [FontFamily.displayBlack]: PlusJakartaSans_800ExtraBold,
  });
  const ready = fontsLoaded || Boolean(fontError);

  useEffect(() => {
    if (fontError) {
      // Fonts are bundled, so this should not happen; fall back to system fonts rather than block the app.
      console.warn("[fonts] Failed to load custom fonts, using system fonts.", fontError);
    }
    if (ready) void SplashScreen.hideAsync();
  }, [ready, fontError]);

  if (!ready) return null;

  // Phase 1 adds the AuthProvider, QueryClientProvider and the (auth)/(app) session gate here.
  return (
    <ThemeProvider value={navigationTheme}>
      <ToastProvider>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.bg } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="dev/ui-kit" />
        </Stack>
      </ToastProvider>
      <StatusBar style="light" />
    </ThemeProvider>
  );
}
