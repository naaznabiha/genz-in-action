import { toPostError } from "@/lib/post-errors";

export type CommunityField = "name" | "description" | "image" | "title" | "body" | "attachment" | "message";

export class CommunityError extends Error {
  field?: CommunityField;
  /** The GENZ_* rule the database applied, when there was one. */
  rule?: string;
  constructor(message: string, field?: CommunityField, rule?: string) {
    super(message);
    this.name = "CommunityError";
    this.field = field;
    this.rule = rule;
  }
}

function parts(error: unknown) {
  const e = (error && typeof error === "object" ? error : {}) as { code?: unknown; message?: unknown; details?: unknown; error?: unknown; statusCode?: unknown };
  const code = typeof e.code === "string" ? e.code : typeof e.statusCode === "string" ? e.statusCode : undefined;
  const text = [e.message, e.details, e.error].filter((v): v is string => typeof v === "string").join(" ");
  return { code, text: text || String(error), lower: (text || String(error)).toLowerCase() };
}

const RULES: Record<string, [string, CommunityField?]> = {
  GENZ_COMMUNITY_PRIVATE: ["This community is invite-only. Ask an admin to invite you."],
  GENZ_COMMUNITY_REMOVED: ["You were removed from this community. An admin can invite you back."],
  GENZ_OWNER_MUST_TRANSFER: ["Choose a new owner before you leave."],
  GENZ_COMMUNITY_HAS_MEMBERS: ["Only a community with no other members can be deleted. Make someone else the owner instead."],
  GENZ_ALREADY_MEMBER: ["They're already a member."],
  GENZ_USE_LEAVE: ["Use Leave community instead."],
  GENZ_ATTACHMENT_PATH: ["That file didn't upload correctly. Try attaching it again.", "attachment"],
  GENZ_ATTACHMENT_NOT_FOUND: ["Your file didn't finish uploading. Try attaching it again.", "attachment"],
  GENZ_ATTACHMENT_TYPE: ["Only JPEG/PNG photos and PDF documents can be attached.", "attachment"],
  GENZ_ATTACHMENT_TOO_LARGE: ["Photos can be up to 5 MB and PDFs up to 10 MB.", "attachment"],
  GENZ_IMAGE_NOT_FOUND: ["The community image didn't finish uploading. Try again.", "image"],
};

/**
 * Readable messages for community actions. Rules come from the Phase 6 RPCs
 * (P0001 GENZ_*), the table constraints (23514) and RLS (42501).
 */
export function toCommunityError(error: unknown): CommunityError {
  if (error instanceof CommunityError) return error;
  const { code, text, lower } = parts(error);

  const rule = /GENZ_[A-Z_]+/.exec(text)?.[0];
  if (rule && RULES[rule]) return new CommunityError(RULES[rule][0], RULES[rule][1], rule);

  if (code === "23514" || lower.includes("violates check constraint")) {
    if (lower.includes("communities_name")) return new CommunityError("Names are 3–60 characters.", "name");
    if (lower.includes("communities_description")) return new CommunityError("Descriptions can be at most 500 characters.", "description");
    if (lower.includes("community_content_title")) return new CommunityError("Titles are 3–120 characters.", "title");
    if (lower.includes("community_content_body")) return new CommunityError("Text can be at most 5,000 characters.", "body");
    if (lower.includes("community_messages_body")) return new CommunityError("Messages can be at most 2,000 characters.", "message");
    if (lower.includes("not_empty")) return new CommunityError("Write a message or attach a file.", "message");
    if (lower.includes("attachment_name")) return new CommunityError("That file name is too long. Rename it and try again.", "attachment");
  }
  if (lower.includes("payload too large") || lower.includes("maximum allowed size") || code === "413") {
    return new CommunityError("That file is too large. Photos can be up to 5 MB and PDFs up to 10 MB.", "attachment");
  }
  if (lower.includes("mime type") || lower.includes("invalid_mime_type")) {
    return new CommunityError("Only JPEG/PNG photos and PDF documents can be attached.", "attachment");
  }
  if (code === "PT404" || lower.includes("not found")) {
    if (lower.includes("invite")) return new CommunityError("That invite isn't available anymore.");
    if (lower.includes("member")) return new CommunityError("They aren't a member anymore.");
    if (lower.includes("user")) return new CommunityError("This account isn't available.");
    return new CommunityError("This community isn't available anymore.");
  }
  if (code === "42501" || lower.includes("row-level security")) {
    if (lower.includes("owner") || lower.includes("admin")) return new CommunityError(text.replace(/^.*?: /, ""));
    return new CommunityError("You don't have permission to do that in this community.");
  }
  return new CommunityError(toPostError(error).message);
}
