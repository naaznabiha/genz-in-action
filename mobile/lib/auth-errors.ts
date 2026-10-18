export function toReadableAuthError(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Something went wrong. Please try again.";

  const lower = message.toLowerCase();

  if (lower.includes("invalid login credentials")) {
    return "Email or password is incorrect.";
  }
  if (lower.includes("email not confirmed")) {
    return "Check your email and confirm your account before logging in.";
  }
  if (lower.includes("user already registered") || lower.includes("already been registered")) {
    return "An account with this email already exists. Try logging in.";
  }
  if (lower.includes("password should be at least") || lower.includes("password is known")) {
    return "Choose a stronger password with at least 6 characters.";
  }
  if (lower.includes("unable to validate email") || lower.includes("invalid email")) {
    return "Enter a valid email address.";
  }
  if (lower.includes("rate limit") || lower.includes("too many requests")) {
    return "Too many attempts. Wait a moment and try again.";
  }
  if (lower.includes("user not found") || lower.includes("signups not allowed")) {
    return "No account was found for that email.";
  }
  if (lower.includes("otp") && (lower.includes("expired") || lower.includes("invalid"))) {
    return "That code is invalid or expired. Request a new one.";
  }
  if (lower.includes("network") || lower.includes("fetch")) {
    return "Network error. Check your connection and try again.";
  }

  return message;
}
