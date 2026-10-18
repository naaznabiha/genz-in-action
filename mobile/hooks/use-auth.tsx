import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session, User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { signOut as signOutRequest } from "@/services/auth";

/** AsyncStorage flag (non-sensitive) so returning users skip onboarding (spec §5.1, FR-01). */
const ONBOARDING_KEY = "genz_has_onboarded";

type AuthContextValue = {
  /** False until the onboarding flag and any persisted session have been read. */
  isReady: boolean;
  session: Session | null;
  user: User | null;
  /** Signed in AND not in the middle of a password reset. Drives the route guard. */
  isSignedIn: boolean;
  hasOnboarded: boolean;
  isConfigured: boolean;
  /**
   * True between entering a valid reset code and finishing the reset flow.
   * Supabase signs the user in when the code is verified; this keeps them on
   * the auth screens until they have set a new password.
   */
  isRecoveringPassword: boolean;
  setRecoveringPassword: (value: boolean) => void;
  completeOnboarding: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function readOnboardingFlag(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ONBOARDING_KEY)) === "true";
  } catch {
    return false; // storage unavailable: showing onboarding again is harmless
  }
}

/**
 * Session state only. Profile data is server state and lives in TanStack Query
 * (hooks/use-profile.ts).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [isReady, setIsReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [hasOnboarded, setHasOnboarded] = useState(false);
  const [isRecoveringPassword, setRecoveringPassword] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      const onboarded = await readOnboardingFlag();
      if (isMounted) setHasOnboarded(onboarded);

      if (isSupabaseConfigured) {
        // Restores the persisted session (spec §5.4). An expired access token is
        // refreshed here; a revoked refresh token yields no session.
        const { data } = await supabase.auth.getSession();
        if (isMounted) setSession(data.session);
      }
      if (isMounted) setIsReady(true);
    }

    void bootstrap();

    if (!isSupabaseConfigured) {
      return () => {
        isMounted = false;
      };
    }

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!isMounted) return;
      setSession(nextSession);
      if (event === "PASSWORD_RECOVERY") setRecoveringPassword(true);
      if (event === "SIGNED_OUT" || !nextSession) {
        // Revoked/expired sessions also arrive here; drop cached user data so the
        // next account never sees the previous one's state.
        setRecoveringPassword(false);
        queryClient.clear();
      }
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, [queryClient]);

  const completeOnboarding = useCallback(async () => {
    setHasOnboarded(true);
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, "true");
    } catch {
      // Non-fatal: onboarding will simply show again next launch.
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await signOutRequest();
    } finally {
      // supabase-js clears the local session even when the network call fails;
      // make sure the UI follows regardless.
      setSession(null);
      setRecoveringPassword(false);
      queryClient.clear();
    }
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isReady,
      session,
      user: session?.user ?? null,
      isSignedIn: Boolean(session) && !isRecoveringPassword,
      hasOnboarded,
      isConfigured: isSupabaseConfigured,
      isRecoveringPassword,
      setRecoveringPassword,
      completeOnboarding,
      signOut,
    }),
    [completeOnboarding, hasOnboarded, isReady, isRecoveringPassword, session, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
