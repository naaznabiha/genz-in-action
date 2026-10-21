/**
 * Client-side validation for auth and profile forms.
 * The database enforces the same username/display-name rules
 * (supabase/migrations/20261018120100_profiles.sql); keep the two in sync.
 */

export const USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/;
export const USERNAME_MAX = 30;
export const DISPLAY_NAME_MAX = 50;
/** Profile limits — mirror the CHECK constraints in public.profiles and the 5-tag trigger. */
export const BIO_MAX = 160;
export const LOCATION_MAX = 80;
export const MAX_PROFILE_TAGS = 5;
/** Upload limit of the avatars and post-media buckets (5 MB, JPEG/PNG). */
export const UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
export const AVATAR_MAX_BYTES = UPLOAD_MAX_BYTES;
/** Post limits — mirror the CHECK constraints in public.posts / public.comments (decision D24). */
export const POST_TITLE_MIN = 10;
export const POST_TITLE_MAX = 100;
export const POST_BODY_MIN = 30;
export const POST_BODY_MAX = 2000;
export const POST_LOCATION_MAX = 80;
export const COMMENT_MAX = 1000;

/** Length of the email code Supabase sends. Must match Auth → Providers → Email → "Email OTP Length". */
export const EMAIL_CODE_LENGTH = 6;

/** Password policy shown to users. Mirror it in Supabase → Auth → Providers → Email (see supabase/README.md). */
export const PASSWORD_MIN = 8;

export function normalizeUsername(raw: string) {
  return raw.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, USERNAME_MAX);
}

export function validateEmail(email: string): string | undefined {
  const value = email.trim();
  if (!value) return "Email is required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Enter a valid email";
  return undefined;
}

export function validateUsername(username: string): string | undefined {
  if (!username) return "Username is required";
  if (username.length < 3) return "At least 3 characters";
  if (!USERNAME_PATTERN.test(username)) return "Use letters, numbers and underscores only";
  return undefined;
}

export function validateDisplayName(name: string): string | undefined {
  const value = name.trim();
  if (!value) return "Name is required";
  if (value.length > DISPLAY_NAME_MAX) return `At most ${DISPLAY_NAME_MAX} characters`;
  return undefined;
}

export function validateBio(bio: string): string | undefined {
  if (bio.trim().length > BIO_MAX) return `At most ${BIO_MAX} characters`;
  return undefined;
}

export function validateLocation(location: string): string | undefined {
  if (location.trim().length > LOCATION_MAX) return `At most ${LOCATION_MAX} characters`;
  return undefined;
}

export type PasswordCheck = { label: string; ok: boolean };

/** Checklist from the prototype's "Set a new password" screen, reused for signup. */
export function passwordChecks(password: string): PasswordCheck[] {
  return [
    { label: `At least ${PASSWORD_MIN} characters`, ok: password.length >= PASSWORD_MIN },
    { label: "One number", ok: /\d/.test(password) },
    { label: "One uppercase letter", ok: /[A-Z]/.test(password) },
  ];
}

export function validatePassword(password: string): string | undefined {
  if (!password) return "Password is required";
  const failed = passwordChecks(password).find((c) => !c.ok);
  return failed ? `Password needs: ${failed.label.toLowerCase()}` : undefined;
}

/** 0 = empty, 1 = weak, 2 = good, 3 = strong — drives the signup strength meter. */
export function passwordStrength(password: string): 0 | 1 | 2 | 3 {
  if (!password) return 0;
  const passed = passwordChecks(password).filter((c) => c.ok).length;
  if (passed < 3) return 1;
  return password.length >= 12 || /[^A-Za-z0-9]/.test(password) ? 3 : 2;
}
