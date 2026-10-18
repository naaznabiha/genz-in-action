import { PASSWORD_MIN } from "@/lib/validation";

/** Error thrown by services/auth.ts: a user-readable message plus the Supabase error code when known. */
export class AuthFlowError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = "AuthFlowError";
    this.code = code;
  }
}

function rawMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "Something went wrong. Please try again.";
}

function rawCode(error: unknown): string | undefined {
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") {
    return error.code;
  }
  return undefined;
}

export function toReadableAuthError(error: unknown): string {
  const code = rawCode(error);
  const lower = rawMessage(error).toLowerCase();

  if (code === "invalid_credentials" || lower.includes("invalid login credentials")) {
    return "Email or password is incorrect.";
  }
  if (code === "email_not_confirmed" || lower.includes("email not confirmed")) {
    return "Confirm your email before logging in.";
  }
  if (code === "user_already_exists" || lower.includes("user already registered") || lower.includes("already been registered")) {
    return "An account with this email already exists. Try logging in.";
  }
  if (code === "same_password" || lower.includes("should be different from the old password")) {
    return "Choose a password you have not used before.";
  }
  if (code === "weak_password" || lower.includes("password should") || lower.includes("password is known")) {
    return `Choose a stronger password: at least ${PASSWORD_MIN} characters with a number and an uppercase letter.`;
  }
  // Raised by public.handle_new_user() when the username was taken between the
  // availability check and signUp(). Supabase Auth hides the original message.
  if (lower.includes("database error saving new user")) {
    return "That username was just taken. Choose another one.";
  }
  if (code === "validation_failed" || lower.includes("unable to validate email") || lower.includes("invalid email")) {
    return "Enter a valid email address.";
  }
  if (code === "over_email_send_rate_limit" || lower.includes("email rate limit")) {
    return "Too many emails sent. Wait a few minutes before requesting another code.";
  }
  if (code?.startsWith("over_") || lower.includes("rate limit") || lower.includes("too many requests") || lower.includes("security purposes")) {
    return "Too many attempts. Wait a moment and try again.";
  }
  if (code === "otp_expired" || (lower.includes("token") && (lower.includes("expired") || lower.includes("invalid")))) {
    return "That code is invalid or expired. Request a new one.";
  }
  // PostgREST: an RPC the app relies on is missing (migrations not run, or schema cache stale).
  if (code === "PGRST202" || lower.includes("could not find the function")) {
    return "The server isn't fully set up yet (a database function is missing). Run the Phase 1 SQL in supabase/README.md, then try again.";
  }
  if (code === "session_not_found" || code === "refresh_token_not_found" || lower.includes("auth session missing")) {
    return "Your session has ended. Please log in again.";
  }
  if (lower.includes("network request failed") || lower.includes("failed to fetch") || lower.includes("network")) {
    return "Network error. Check your connection and try again.";
  }

  return rawMessage(error);
}

export function toAuthFlowError(error: unknown): AuthFlowError {
  if (error instanceof AuthFlowError) return error;
  return new AuthFlowError(toReadableAuthError(error), rawCode(error));
}
