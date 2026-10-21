import { base64ToBytes } from "@/lib/base64";
import { PostError, toPostError } from "@/lib/post-errors";
import { requireSupabaseConfig, supabase } from "@/lib/supabase";
import type { Comment, Post, PostCursor, PostInput, PostPage, PostRow } from "@/types/post";

const MEDIA_BUCKET = "post-media";
/** Signed photo URLs last an hour; queries refetch long before that. */
const SIGNED_URL_SECONDS = 3600;
export const PAGE_SIZE = 20;

/**
 * Adds signed URLs for private post photos with ONE batch call per page
 * (never one call per post). Posts the viewer may not see never reach here
 * (RLS), and the bucket's own policy re-checks visibility when signing.
 */
export async function withMediaUrls(rows: PostRow[]): Promise<Post[]> {
  const paths = rows.map((r) => r.media_path).filter((p): p is string => Boolean(p));
  const urls = new Map<string, string>();
  if (paths.length > 0) {
    const { data, error } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
    if (!error && data) {
      for (const item of data) if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
    }
    // A signing failure shows the post without its photo rather than failing the feed.
  }
  return rows.map((r) => ({ ...r, media_url: r.media_path ? (urls.get(r.media_path) ?? null) : null }));
}

type FetchPostsArgs = {
  category?: string | null;
  authorId?: string | null;
  cursor?: PostCursor | null;
  limit?: number;
};

/** One page of the feed (or of one author's posts): posts + authors + counters + my like/save state in one RPC. */
export async function fetchPosts({ category, authorId, cursor, limit = PAGE_SIZE }: FetchPostsArgs): Promise<PostPage> {
  requireSupabaseConfig();
  const { data, error } = await supabase.rpc("get_posts", {
    p_category: category ?? null,
    p_author_id: authorId ?? null,
    p_before_created: cursor?.createdAt ?? null,
    p_before_id: cursor?.id ?? null,
    p_limit: limit,
  });
  if (error) throw toPostError(error);
  const rows = (data ?? []) as PostRow[];
  const posts = await withMediaUrls(rows);
  const last = rows[rows.length - 1];
  return { posts, nextCursor: rows.length === limit && last ? { createdAt: last.created_at, id: last.id } : null };
}

/** A single post, or null if it doesn't exist or the viewer may not see it. */
export async function fetchPost(postId: string): Promise<Post | null> {
  requireSupabaseConfig();
  const { data, error } = await supabase.rpc("get_posts", { p_post_id: postId, p_limit: 1 });
  if (error) throw toPostError(error);
  const rows = (data ?? []) as PostRow[];
  if (rows.length === 0) return null;
  return (await withMediaUrls(rows))[0];
}

/** "Featured Action": the most-liked recent action post the viewer can see, if any. */
export async function fetchFeaturedPost(): Promise<Post | null> {
  requireSupabaseConfig();
  const { data, error } = await supabase.rpc("get_posts", { p_mode: "featured", p_limit: 1 });
  if (error) throw toPostError(error);
  const rows = (data ?? []) as PostRow[];
  if (rows.length === 0) return null;
  return (await withMediaUrls(rows))[0];
}

/** Uploads a post photo to <userId>/post-<timestamp>.jpg (no overwrites) and returns its path. */
export async function uploadPostImage(userId: string, jpegBase64: string): Promise<string> {
  requireSupabaseConfig();
  const path = `${userId}/post-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, base64ToBytes(jpegBase64), {
    contentType: "image/jpeg",
    upsert: false,
    cacheControl: "3600",
  });
  if (error) {
    const e = toPostError(error);
    throw new PostError(e.field === "photo" ? e.message : `Photo upload failed: ${e.message}`, "photo");
  }
  return path;
}

/** Best-effort removal of a post photo the user owns. */
export async function deletePostImage(path: string | null | undefined): Promise<void> {
  if (!path) return;
  try {
    const { error } = await supabase.storage.from(MEDIA_BUCKET).remove([path]);
    if (error && __DEV__) console.warn("[post-media] could not delete", path, error.message);
  } catch (error) {
    if (__DEV__) console.warn("[post-media] could not delete", path, error);
  }
}

function rpcArgs(input: PostInput) {
  return {
    p_type: input.type,
    p_category: input.category,
    p_title: input.title,
    p_body: input.body,
    p_location: input.location,
    p_event_at: input.type === "event" ? input.eventAt : null,
    p_media_path: input.mediaPath,
    p_media_width: input.mediaWidth,
    p_media_height: input.mediaHeight,
  };
}

/** Creates the post and its photo row atomically; returns the new post id. */
export async function createPost(input: PostInput): Promise<string> {
  requireSupabaseConfig();
  const { data, error } = await supabase.rpc("create_post", rpcArgs(input));
  if (error) throw toPostError(error);
  return data as string;
}

/** Edits the post atomically; returns the storage path of a photo that is no longer used (to delete), or null. */
export async function updatePost(postId: string, input: PostInput): Promise<string | null> {
  requireSupabaseConfig();
  const { data, error } = await supabase.rpc("update_post", { p_post_id: postId, ...rpcArgs(input) });
  if (error) throw toPostError(error);
  return (data as string | null) ?? null;
}

/** Deletes the caller's post (likes, saves, comments, tags and photo row cascade), then its photo file. */
export async function deletePost(postId: string, mediaPath: string | null): Promise<void> {
  requireSupabaseConfig();
  const { data, error } = await supabase.from("posts").delete().eq("id", postId).select("id");
  if (error) throw toPostError(error);
  if (!data || data.length === 0) throw new PostError("You can only delete your own posts.");
  await deletePostImage(mediaPath);
}

// ---------------------------------------------------------------- likes / saves
/** Idempotent: a second like (double tap, retry) is ignored by the primary key. */
export async function likePost(postId: string, userId: string) {
  requireSupabaseConfig();
  const { error } = await supabase
    .from("post_likes")
    .upsert({ post_id: postId, user_id: userId }, { onConflict: "post_id,user_id", ignoreDuplicates: true });
  if (error) throw toPostError(error);
}

export async function unlikePost(postId: string, userId: string) {
  requireSupabaseConfig();
  const { error } = await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", userId);
  if (error) throw toPostError(error);
}

export async function savePost(postId: string, userId: string) {
  requireSupabaseConfig();
  const { error } = await supabase
    .from("post_saves")
    .upsert({ post_id: postId, user_id: userId }, { onConflict: "post_id,user_id", ignoreDuplicates: true });
  if (error) throw toPostError(error);
}

export async function unsavePost(postId: string, userId: string) {
  requireSupabaseConfig();
  const { error } = await supabase.from("post_saves").delete().eq("post_id", postId).eq("user_id", userId);
  if (error) throw toPostError(error);
}

// ---------------------------------------------------------------- comments
const COMMENT_COLUMNS = "id, post_id, author_id, body, created_at, updated_at, author:profiles(username, display_name, avatar_path)";

/** Comments oldest-first with their authors in the same request. Hidden commenters (blocks) are excluded by RLS. */
export async function fetchComments(postId: string): Promise<Comment[]> {
  requireSupabaseConfig();
  const { data, error } = await supabase
    .from("comments")
    .select(COMMENT_COLUMNS)
    .eq("post_id", postId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(200);
  if (error) throw toPostError(error);
  return (data ?? []) as unknown as Comment[];
}

export async function addComment(postId: string, userId: string, body: string): Promise<void> {
  requireSupabaseConfig();
  const { error } = await supabase.from("comments").insert({ post_id: postId, author_id: userId, body: body.trim() });
  if (error) throw toPostError(error);
}

export async function editComment(commentId: string, body: string): Promise<void> {
  requireSupabaseConfig();
  const { data, error } = await supabase.from("comments").update({ body: body.trim() }).eq("id", commentId).select("id");
  if (error) throw toPostError(error);
  if (!data || data.length === 0) throw new PostError("You can only edit your own comments.");
}

export async function deleteComment(commentId: string): Promise<void> {
  requireSupabaseConfig();
  const { data, error } = await supabase.from("comments").delete().eq("id", commentId).select("id");
  if (error) throw toPostError(error);
  if (!data || data.length === 0) throw new PostError("You can only delete your own comments.");
}
