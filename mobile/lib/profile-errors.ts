import { toReadableAuthError } from "@/lib/auth-errors";

/** Which Edit Profile field an error belongs to, so it can be shown under that field. */
export type ProfileField = "displayName" | "username" | "bio" | "location" | "tags" | "photo";

export class ProfileSaveError extends Error {
  field?: ProfileField;
  constructor(message: string, field?: ProfileField) {
    super(message);
    this.name = "ProfileSaveError";
    this.field = field;
  }
}

type RawError = { code?: unknown; message?: unknown; details?: unknown; statusCode?: unknown; error?: unknown };

function parts(error: unknown) {
  const e = (error && typeof error === "object" ? error : {}) as RawError;
  const code = typeof e.code === "string" ? e.code : undefined;
  const text = [e.message, e.details, e.error]
    .filter((v): v is string => typeof v === "string")
    .join(" ")
    .toLowerCase();
  return { code, text: text || String(error).toLowerCase() };
}

/**
 * Turns a Postgres / PostgREST / Storage error from saving the profile into a
 * readable message. Codes come from public.update_my_profile and the profiles
 * constraints (supabase/migrations/20261021100400_update_my_profile_rpc.sql).
 */
export function toProfileSaveError(error: unknown): ProfileSaveError {
  if (error instanceof ProfileSaveError) return error;
  const { code, text } = parts(error);

  if (code === "23505" || text.includes("profiles_username_lower_key") || text.includes("duplicate key")) {
    return new ProfileSaveError("That username is already taken. Try another one.", "username");
  }
  if (code === "23514" || text.includes("violates check constraint")) {
    if (text.includes("username")) return new ProfileSaveError("Usernames are 3–30 characters: a–z, 0–9 and _.", "username");
    if (text.includes("display_name")) return new ProfileSaveError("Enter a name of 1–50 characters.", "displayName");
    if (text.includes("bio")) return new ProfileSaveError("Your bio can be at most 160 characters.", "bio");
    if (text.includes("location")) return new ProfileSaveError("Location can be at most 80 characters.", "location");
    if (text.includes("avatar")) return new ProfileSaveError("That photo can't be used. Choose another one.", "photo");
  }
  if (text.includes("genz_too_many_tags")) return new ProfileSaveError("Choose up to 5 tags.", "tags");
  if (text.includes("genz_unknown_tag")) return new ProfileSaveError("One of those tags is no longer available.", "tags");
  if (text.includes("genz_avatar_not_found")) {
    return new ProfileSaveError("Your photo didn't finish uploading. Try choosing it again.", "photo");
  }
  // Storage API: bucket limits (5 MB, JPEG/PNG) and policy rejections.
  if (text.includes("payload too large") || text.includes("exceeded the maximum allowed size") || code === "413") {
    return new ProfileSaveError("That photo is larger than 5 MB. Choose a smaller one.", "photo");
  }
  if (text.includes("mime type") || text.includes("invalid_mime_type")) {
    return new ProfileSaveError("Only JPEG and PNG photos are supported.", "photo");
  }
  if (text.includes("row-level security") || text.includes("unauthorized")) {
    return new ProfileSaveError("You can only change your own profile. Log in again and retry.");
  }
  if (code === "42501" || text.includes("genz_not_signed_in")) {
    return new ProfileSaveError("Your session has ended. Please log in again.");
  }
  if (code === "PGRST202" || text.includes("could not find the function")) {
    return new ProfileSaveError(
      "The server isn't fully set up yet (Phase 2 database changes are missing). Run the Phase 2 SQL in supabase/README.md, then try again.",
    );
  }
  return new ProfileSaveError(toReadableAuthError(error));
}

/** Readable message for any other Phase 2 data error (settings, impact, tags). */
export function toReadableDataError(error: unknown): string {
  const { code, text } = parts(error);
  if (code === "PGRST205" || code === "PGRST202" || text.includes("schema cache")) {
    return "The server isn't fully set up yet (Phase 2 database changes are missing). Run the Phase 2 SQL in supabase/README.md.";
  }
  return toReadableAuthError(error);
}
