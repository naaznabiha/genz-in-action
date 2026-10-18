import { AuthFlowError, toAuthFlowError, toReadableAuthError } from "@/lib/auth-errors";
import { requireSupabaseConfig, supabase } from "@/lib/supabase";

/**
 * All Supabase Auth calls used by the Phase 1 auth flow.
 * Every function throws AuthFlowError (readable message + Supabase error code).
 *
 * Email verification and password reset use 6-digit email codes instead of
 * links (decision D5), so they work in Expo Go without deep-link setup.
 * This requires {{ .Token }} in the "Confirm signup" and "Reset password"
 * email templates — see supabase/README.md, manual step M3.
 */

/** Server-side, case-insensitive availability check (RPC public.is_username_available). */
export async function isUsernameAvailable(username: string): Promise<boolean> {
  requireSupabaseConfig();
  const { data, error } = await supabase.rpc("is_username_available", { candidate: username });
  if (error) throw new AuthFlowError(toReadableAuthError(error), error.code);
  return data === true;
}

export type SignUpResult = {
  /** True when Supabase requires the user to confirm their email before a session is issued. */
  needsEmailConfirmation: boolean;
};

export async function signUpWithEmail(input: {
  email: string;
  password: string;
  displayName: string;
  username: string;
}): Promise<SignUpResult> {
  requireSupabaseConfig();
  const username = input.username.trim().toLowerCase();

  if (!(await isUsernameAvailable(username))) {
    throw new AuthFlowError("That username is already taken.", "username_taken");
  }

  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      // Read by public.handle_new_user() to create the profile row.
      data: { display_name: input.displayName.trim(), username },
    },
  });
  if (error) throw toAuthFlowError(error);

  // With email confirmation on, Supabase does not reveal that an email is
  // already registered: it returns a user with no identities and sends no email.
  if (data.user && !data.session && (data.user.identities?.length ?? 0) === 0) {
    throw new AuthFlowError("An account with this email already exists. Try logging in.", "user_already_exists");
  }

  return { needsEmailConfirmation: !data.session };
}

/** Confirms a new account with the code from the "Confirm signup" email. Establishes a session. */
export async function verifySignupCode(email: string, code: string) {
  requireSupabaseConfig();
  const { data, error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
  if (error) throw toAuthFlowError(error);
  return data.session;
}

export async function resendSignupCode(email: string) {
  requireSupabaseConfig();
  const { error } = await supabase.auth.resend({ type: "signup", email: email.trim() });
  if (error) throw toAuthFlowError(error);
}

export async function signInWithEmail(email: string, password: string) {
  requireSupabaseConfig();
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw toAuthFlowError(error);
  return data.session;
}

/** Ends the session on this device. Local state is cleared even if the network call fails. */
export async function signOut() {
  requireSupabaseConfig();
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) throw toAuthFlowError(error);
}

/**
 * Sends the "Reset password" email. Supabase responds the same way whether or
 * not the address has an account, so the UI must not claim the account exists.
 */
export async function requestPasswordReset(email: string) {
  requireSupabaseConfig();
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
  if (error) throw toAuthFlowError(error);
}

/** Verifies the reset code. On success Supabase signs the user in (recovery session). */
export async function verifyRecoveryCode(email: string, code: string) {
  requireSupabaseConfig();
  const { data, error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "recovery" });
  if (error) throw toAuthFlowError(error);
  return data.session;
}

/**
 * Sets a new password for the signed-in (recovery) user, then revokes the
 * user's sessions on other devices so the "signed out everywhere else"
 * message in the UI is true. Revocation failure is reported but does not
 * undo the password change.
 */
export async function updatePassword(newPassword: string): Promise<{ otherSessionsRevoked: boolean }> {
  requireSupabaseConfig();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw toAuthFlowError(error);

  const { error: revokeError } = await supabase.auth.signOut({ scope: "others" });
  return { otherSessionsRevoked: !revokeError };
}
