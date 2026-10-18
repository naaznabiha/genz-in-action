import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session, User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { fetchProfile, signOut as signOutRequest } from "@/services/auth";
import type { Profile } from "@/types/profile";

const ONBOARDING_KEY = "genz_has_onboarded";

type AuthContextValue = {
  isReady: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  hasOnboarded: boolean;
  isConfigured: boolean;
  completeOnboarding: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [hasOnboarded, setHasOnboarded] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      const onboardedValue = await AsyncStorage.getItem(ONBOARDING_KEY);
      if (isMounted) setHasOnboarded(onboardedValue === "true");

      if (!isSupabaseConfigured) {
        if (isMounted) setIsReady(true);
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (!isMounted) return;

      setSession(data.session);
      if (data.session?.user.id) {
        try {
          const nextProfile = await fetchProfile(data.session.user.id);
          if (isMounted) setProfile(nextProfile);
        } catch {
          if (isMounted) setProfile(null);
        }
      }
      if (isMounted) setIsReady(true);
    }

    void bootstrap();

    if (!isSupabaseConfigured) return () => {
      isMounted = false;
    };

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession?.user.id) {
        setProfile(null);
        return;
      }
      void fetchProfile(nextSession.user.id)
        .then(setProfile)
        .catch(() => setProfile(null));
    });

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isReady,
      session,
      user: session?.user ?? null,
      profile,
      hasOnboarded,
      isConfigured: isSupabaseConfigured,
      completeOnboarding: async () => {
        await AsyncStorage.setItem(ONBOARDING_KEY, "true");
        setHasOnboarded(true);
      },
      refreshProfile: async () => {
        if (!session?.user.id) {
          setProfile(null);
          return;
        }
        setProfile(await fetchProfile(session.user.id));
      },
      signOut: async () => {
        await signOutRequest();
        setProfile(null);
      },
    }),
    [hasOnboarded, isReady, profile, session],
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
