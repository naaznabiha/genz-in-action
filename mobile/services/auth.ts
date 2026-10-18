import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { toReadableAuthError } from "@/lib/auth-errors";
import type { Profile } from "@/types/profile";

function requireConfig() {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to mobile/.env",
    );
  }
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  requireConfig();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, username, display_name, avatar_url, bio, cause, location, website, followers_count, following_count, actions_count, impact_points, is_verified, created_at",
    )
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(toReadableAuthError(error.message));
  return data as Profile | null;
}

export async function isUsernameTaken(username: string): Promise<boolean> {
  requireConfig();
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .ilike("username", username)
    .maybeSingle();

  if (error) throw new Error(toReadableAuthError(error.message));
  return Boolean(data);
}

export async function signUpWithEmail(input: {
  email: string;
  password: string;
  displayName: string;
  username: string;
}) {
  requireConfig();

  if (await isUsernameTaken(input.username)) {
    throw new Error("That username is already taken.");
  }

  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      data: {
        display_name: input.displayName.trim(),
        username: input.username.trim().toLowerCase(),
      },
    },
  });

  if (error) throw new Error(toReadableAuthError(error));

  return {
    session: data.session,
    needsEmailConfirmation: !data.session && Boolean(data.user),
  };
}

export async function signInWithEmail(email: string, password: string) {
  requireConfig();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw new Error(toReadableAuthError(error));
  return data.session;
}

export async function signOut() {
  requireConfig();
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(toReadableAuthError(error));
}

export async function sendLoginOtp(email: string) {
  requireConfig();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: { shouldCreateUser: false },
  });
  if (error) throw new Error(toReadableAuthError(error));
}

export async function verifyEmailOtp(email: string, token: string) {
  requireConfig();
  const { data, error } = await supabase.auth.verifyOtp({
    email: email.trim(),
    token: token.trim(),
    type: "email",
  });
  if (error) throw new Error(toReadableAuthError(error));
  return data.session;
}
