import { toReadableDataError } from "@/lib/profile-errors";

export type PostField = "title" | "body" | "location" | "eventAt" | "photo" | "category" | "comment";

export class PostError extends Error {
  field?: PostField;
  constructor(message: string, field?: PostField) {
    super(message);
    this.name = "PostError";
    this.field = field;
  }
}

function parts(error: unknown) {
  const e = (error && typeof error === "object" ? error : {}) as { code?: unknown; message?: unknown; details?: unknown; error?: unknown; statusCode?: unknown };
  const code = typeof e.code === "string" ? e.code : typeof e.statusCode === "string" ? e.statusCode : undefined;
  const text = [e.message, e.details, e.error].filter((v): v is string => typeof v === "string").join(" ").toLowerCase();
  return { code, text: text || String(error).toLowerCase() };
}

/**
 * Readable messages for post / comment / like / save / follow / block errors.
 * Codes come from the Phase 3 constraints and RPCs.
 */
export function toPostError(error: unknown): PostError {
  if (error instanceof PostError) return error;
  const { code, text } = parts(error);

  if (code === "23514" || text.includes("violates check constraint")) {
    if (text.includes("posts_title")) return new PostError("Titles are 10–100 characters.", "title");
    if (text.includes("posts_body")) return new PostError("Descriptions are 30–2000 characters.", "body");
    if (text.includes("posts_location")) return new PostError("Location can be at most 80 characters.", "location");
    if (text.includes("event_at")) return new PostError("Only events can have a date.", "eventAt");
    if (text.includes("comments_body")) return new PostError("Comments are 1–1000 characters.", "comment");
  }
  if (text.includes("genz_media_not_found")) return new PostError("Your photo didn't finish uploading. Try adding it again.", "photo");
  if (text.includes("payload too large") || text.includes("maximum allowed size") || code === "413") {
    return new PostError("That photo is larger than 5 MB. Choose a smaller one.", "photo");
  }
  if (text.includes("mime type") || text.includes("invalid_mime_type")) return new PostError("Only JPEG and PNG photos are supported.", "photo");
  if (code === "23503" && text.includes("category")) return new PostError("Choose a category.", "category");
  if (text.includes("genz_not_your_post")) return new PostError("You can only edit your own posts.");
  if (text.includes("genz_user_not_found")) return new PostError("This account isn't available.");
  if (text.includes("genz_request_not_found")) return new PostError("That request no longer exists.");
  if (text.includes("genz_follow_self")) return new PostError("You can't follow yourself.");
  if (text.includes("genz_block_self")) return new PostError("You can't block yourself.");
  if (code === "42501" || text.includes("row-level security")) {
    return new PostError("This post isn't available anymore, or you don't have access to it.");
  }
  return new PostError(toReadableDataError(error));
}
