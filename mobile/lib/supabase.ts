import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured && __DEV__) {
  console.warn(
    "[supabase] EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY are not set. " +
      "Copy mobile/.env.example to mobile/.env, fill in your project's values, then restart `npx expo start`. " +
      "Backend calls will fail until this is done.",
  );
}

/** Call at the top of every service function so a missing .env produces a readable error. */
export function requireSupabaseConfig() {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to mobile/.env",
    );
  }
}

/**
 * Inert client used only when env vars are missing, so imports don't crash.
 * Every service function calls requireSupabaseConfig() first and throws a readable error instead of using it.
 */
function createUnavailableClient(): SupabaseClient {
  return createClient("https://example.supabase.co", "public-anon-key", {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        // Native: persist the session in AsyncStorage (decision D9). Web: let supabase-js use
        // its default localStorage, which is also safe during static rendering (no window).
        ...(Platform.OS !== "web" ? { storage: AsyncStorage } : {}),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : createUnavailableClient();

if (isSupabaseConfigured && Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") {
      void supabase.auth.startAutoRefresh();
    } else {
      void supabase.auth.stopAutoRefresh();
    }
  });
}
