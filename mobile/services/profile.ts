import { toReadableAuthError } from "@/lib/auth-errors";
import { ProfileSaveError, toProfileSaveError, toReadableDataError } from "@/lib/profile-errors";
import { requireSupabaseConfig, supabase } from "@/lib/supabase";
import {
  PROFILE_COLUMNS,
  PROFILE_TAG_COLUMNS,
  type EarnedBadge,
  type Profile,
  type ProfileTag,
  type ProfileUpdate,
} from "@/types/profile";

const AVATAR_BUCKET = "avatars";

/** Profile row for a user, or null if it does not exist (yet). RLS: any signed-in user may read profiles. */
export async function fetchProfile(userId: string): Promise<Profile | null> {
  requireSupabaseConfig();
  const { data, error } = await supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", userId).maybeSingle();
  if (error) throw new Error(toReadableAuthError(error));
  return data as Profile | null;
}

/** Tags a user shows on their profile, in catalogue order. */
export async function fetchProfileTags(userId: string): Promise<ProfileTag[]> {
  requireSupabaseConfig();
  const { data, error } = await supabase
    .from("user_profile_tags")
    .select(`tag:profile_tags(${PROFILE_TAG_COLUMNS})`)
    .eq("user_id", userId);
  if (error) throw new Error(toReadableDataError(error));
  const rows = (data ?? []) as unknown as { tag: ProfileTag | null }[];
  return rows
    .map((r) => r.tag)
    .filter((t): t is ProfileTag => Boolean(t))
    .sort((a, b) => a.sort_order - b.sort_order);
}

/** The selectable tag catalogue (public.profile_tags, active only). */
export async function fetchTagCatalogue(): Promise<ProfileTag[]> {
  requireSupabaseConfig();
  const { data, error } = await supabase
    .from("profile_tags")
    .select(PROFILE_TAG_COLUMNS)
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw new Error(toReadableDataError(error));
  return (data ?? []) as ProfileTag[];
}

/** Badges a user has earned (empty until badge rules exist). */
export async function fetchEarnedBadges(userId: string): Promise<EarnedBadge[]> {
  requireSupabaseConfig();
  const { data, error } = await supabase
    .from("user_badges")
    .select("awarded_at, badge:badges(id, name, description, emoji)")
    .eq("user_id", userId)
    .order("awarded_at", { ascending: false });
  if (error) throw new Error(toReadableDataError(error));
  const rows = (data ?? []) as unknown as {
    awarded_at: string;
    badge: Omit<EarnedBadge, "awarded_at"> | null;
  }[];
  return rows.filter((r) => r.badge).map((r) => ({ ...(r.badge as Omit<EarnedBadge, "awarded_at">), awarded_at: r.awarded_at }));
}

/**
 * Saves Edit Profile atomically (public.update_my_profile): name, username,
 * bio, location, avatar path and tags succeed or fail together. Username
 * uniqueness, field limits, the 5-tag rule and avatar ownership are all
 * enforced by the database; errors come back as ProfileSaveError.
 */
export async function updateMyProfile(update: ProfileUpdate): Promise<void> {
  requireSupabaseConfig();
  const { error } = await supabase.rpc("update_my_profile", {
    p_display_name: update.displayName,
    p_username: update.username,
    p_bio: update.bio,
    p_location: update.location,
    p_avatar_path: update.avatarPath,
    p_tag_ids: update.tagIds,
  });
  if (error) throw toProfileSaveError(error);
}

/** Public URL of an avatar object (no network call). Null when there is no photo. */
export function avatarPublicUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Decodes base64 without relying on a global atob (Hermes/JSC differences). */
function base64ToBytes(base64: string): Uint8Array {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const lookup = new Uint8Array(128);
  for (let i = 0; i < alphabet.length; i++) lookup[alphabet.charCodeAt(i)] = i;
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, "");
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = lookup[clean.charCodeAt(i)];
    const b = lookup[clean.charCodeAt(i + 1)];
    const c = lookup[clean.charCodeAt(i + 2)];
    const d = lookup[clean.charCodeAt(i + 3)];
    bytes[p++] = (a << 2) | (b >> 4);
    if (i + 2 < clean.length) bytes[p++] = ((b & 15) << 4) | (c >> 2);
    if (i + 3 < clean.length) bytes[p++] = ((c & 3) << 6) | d;
  }
  return bytes.subarray(0, p);
}

/**
 * Uploads a JPEG avatar to <userId>/avatar-<timestamp>.jpg and returns its path.
 * A new file name is used every time: the bucket allows no overwrites (so no
 * one can replace anyone's photo) and new names avoid stale CDN caches.
 */
export async function uploadAvatar(userId: string, jpegBase64: string): Promise<string> {
  requireSupabaseConfig();
  const path = `${userId}/avatar-${Date.now()}.jpg`;
  const bytes = base64ToBytes(jpegBase64);
  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, bytes, {
    contentType: "image/jpeg",
    upsert: false,
    cacheControl: "31536000",
  });
  if (error) {
    const e = toProfileSaveError(error);
    throw new ProfileSaveError(e.field === "photo" ? e.message : `Photo upload failed: ${e.message}`, "photo");
  }
  return path;
}

/** Best-effort removal of an avatar file the user owns (old photo after a change, or an unused upload). */
export async function deleteAvatarFile(path: string): Promise<void> {
  if (!path) return;
  try {
    requireSupabaseConfig();
    const { error } = await supabase.storage.from(AVATAR_BUCKET).remove([path]);
    if (error && __DEV__) console.warn("[avatar] could not delete old file", path, error.message);
  } catch (error) {
    if (__DEV__) console.warn("[avatar] could not delete old file", path, error);
  }
}
