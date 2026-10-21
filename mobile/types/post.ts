/**
 * Post shapes. `PostRow` is one row of public.get_posts()
 * (supabase/migrations/20261021120800_post_rpcs.sql). Decision D24: type is a
 * label only; no petition goal / sign / RSVP (D25).
 */
export type PostType = "action" | "event" | "petition" | "story";

export const POST_TYPES: { id: PostType; label: string; emoji: string; desc: string; color: string }[] = [
  { id: "action", label: "Take Action", emoji: "⚡", desc: "Call to action or campaign", color: "#00BFBF" },
  { id: "event", label: "Event", emoji: "📅", desc: "In-person or virtual event", color: "#0EA5E9" },
  { id: "petition", label: "Petition", emoji: "✍️", desc: "Signature drive or demand", color: "#FF5555" },
  { id: "story", label: "Story", emoji: "📖", desc: "Share your experience", color: "#F59E0B" },
];

export function postTypeMeta(type: string) {
  return POST_TYPES.find((t) => t.id === type) ?? POST_TYPES[3];
}

export type PostRow = {
  id: string;
  author_id: string;
  author_username: string;
  author_display_name: string;
  author_avatar_path: string | null;
  type: PostType;
  category: string;
  title: string;
  body: string;
  location: string | null;
  event_at: string | null;
  like_count: number;
  comment_count: number;
  created_at: string;
  updated_at: string;
  media_path: string | null;
  media_width: number | null;
  media_height: number | null;
  liked_by_me: boolean;
  saved_by_me: boolean;
};

/** PostRow plus a short-lived signed URL for its private photo (post-media bucket). */
export type Post = PostRow & { media_url: string | null };

/**
 * Cursor for the next page (spec §13.1, keyset — never offsets): created_at + id,
 * plus the score for "Top posts this week" (ordered by likes + 2×comments first).
 */
export type PostCursor = { createdAt: string; id: string; score?: number };

export type PostPage = { posts: Post[]; nextCursor: PostCursor | null };

/** Everything the composer saves (create_post / update_post). */
export type PostInput = {
  type: PostType;
  category: string;
  title: string;
  body: string;
  location: string;
  eventAt: string | null;
  /** Storage path of an already-uploaded photo, or null for none. */
  mediaPath: string | null;
  mediaWidth: number | null;
  mediaHeight: number | null;
};

export type Comment = {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  author: { username: string; display_name: string; avatar_path: string | null } | null;
};
