import { base64ToBytes } from "@/lib/base64";
import { CommunityError, toCommunityError } from "@/lib/community-errors";
import { requireSupabaseConfig, supabase } from "@/lib/supabase";
import { withMediaUrls } from "@/services/posts";
import type {
  Attachment,
  CommunityCursor,
  CommunityDetail,
  CommunityMember,
  CommunityMessage,
  CommunityPage,
  CommunityRole,
  CommunitySummary,
  ContentItem,
  FeedFilter,
  FeedRow,
  MemberCursor,
  MemberPage,
  MessageCursor,
  MessagePage,
  MessageRow,
  MyCommunityInvite,
  PendingInvite,
  PickedAttachment,
  PinnedMessage,
  StarredPage,
  StarredRow,
} from "@/types/community";
import type { Post, PostRow, PostType } from "@/types/post";

/**
 * Communities (Phase 6, spec §11). Membership, invites and roles change only
 * through RPCs; messages, pins, stars and content are written directly and
 * the database's RLS policies decide who may (D49). Nothing here is a
 * security check — the app only hides buttons a person can't use.
 */
const MEDIA_BUCKET = "community-media"; // private: discussion + content files
const IMAGE_BUCKET = "community-images"; // public: community cover images
const SIGNED_URL_SECONDS = 3600;
export const COMMUNITY_PAGE = 20;
export const MESSAGE_PAGE = 50;

// ---------------------------------------------------------------- files
export function communityImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function uploadCommunityImage(userId: string, jpegBase64: string): Promise<string> {
  requireSupabaseConfig();
  const path = `${userId}/community-${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(path, base64ToBytes(jpegBase64), { contentType: "image/jpeg", upsert: false, cacheControl: "3600" });
  if (error) throw new CommunityError(`Image upload failed: ${toCommunityError(error).message}`, "image");
  return path;
}

export async function deleteCommunityImage(path: string | null | undefined) {
  if (!path) return;
  try {
    await supabase.storage.from(IMAGE_BUCKET).remove([path]);
  } catch {
    /* best effort */
  }
}

/** Uploads a picked photo / PDF to <community>/<me>/<prefix>-<time>.(jpg|pdf). */
async function uploadAttachment(communityId: string, userId: string, file: PickedAttachment, prefix: "msg" | "content") {
  const ext = file.kind === "image" ? "jpg" : "pdf";
  const path = `${communityId}/${userId}/${prefix}-${Date.now()}.${ext}`;
  const body = file.kind === "image" ? base64ToBytes(file.base64) : file.bytes;
  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, body, { contentType: file.kind === "image" ? "image/jpeg" : "application/pdf", upsert: false, cacheControl: "3600" });
  if (error) {
    const e = toCommunityError(error);
    throw new CommunityError(e.field === "attachment" ? e.message : `Upload failed: ${e.message}`, "attachment");
  }
  return path;
}

async function removeAttachment(path: string | null | undefined) {
  if (!path) return;
  try {
    await supabase.storage.from(MEDIA_BUCKET).remove([path]);
  } catch {
    /* best effort */
  }
}

/** Signs every attachment on a page with ONE call. The bucket's policy re-checks access. */
async function signPaths(paths: (string | null | undefined)[]): Promise<Map<string, string>> {
  const list = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  const urls = new Map<string, string>();
  if (list.length === 0) return urls;
  const { data, error } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrls(list, SIGNED_URL_SECONDS);
  if (!error && data) for (const item of data) if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
  return urls;
}

type AttachmentColumns = {
  attachment_path: string | null;
  attachment_kind: "image" | "pdf" | null;
  attachment_name: string | null;
  attachment_size: number | null;
  attachment_width?: number | null;
  attachment_height?: number | null;
};

function attachmentOf(row: AttachmentColumns, urls: Map<string, string>): Attachment | null {
  if (!row.attachment_path || !row.attachment_kind) return null;
  return {
    path: row.attachment_path,
    kind: row.attachment_kind,
    name: row.attachment_name,
    size: row.attachment_size,
    width: row.attachment_width ?? null,
    height: row.attachment_height ?? null,
    url: urls.get(row.attachment_path) ?? null,
  };
}

/** A fresh signed URL for one file (opening a PDF after the page's URL expired). */
export async function signAttachment(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS);
  if (error || !data?.signedUrl) throw new CommunityError("This file isn't available anymore.");
  return data.signedUrl;
}

// ---------------------------------------------------------------- lists + detail
export async function fetchCommunities(scope: "discover" | "mine", query: string | null, cursor: CommunityCursor | null, limit = COMMUNITY_PAGE): Promise<CommunityPage> {
  requireSupabaseConfig();
  const { data, error } = await supabase.rpc("get_communities", {
    p_scope: scope,
    p_query: query || null,
    p_before_created: cursor?.createdAt ?? null,
    p_before_id: cursor?.id ?? null,
    p_limit: limit,
  });
  if (error) throw toCommunityError(error);
  const rows = (data ?? []) as CommunitySummary[];
  const last = rows[rows.length - 1];
  return { communities: rows, nextCursor: rows.length === limit && last ? { createdAt: last.created_at, id: last.id } : null };
}

export async function fetchMyInvites(): Promise<MyCommunityInvite[]> {
  requireSupabaseConfig();
  const { data, error } = await supabase.rpc("get_my_community_invites");
  if (error) throw toCommunityError(error);
  return (data ?? []) as MyCommunityInvite[];
}

export async function fetchCommunity(id: string): Promise<CommunityDetail | null> {
  requireSupabaseConfig();
  const { data, error } = await supabase.rpc("get_community", { p_community: id });
  if (error) {
    if ((error as { code?: string }).code === "PT404") return null;
    throw toCommunityError(error);
  }
  const rows = (data ?? []) as CommunityDetail[];
  return rows[0] ?? null;
}

// ---------------------------------------------------------------- community + membership RPCs
async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  requireSupabaseConfig();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw toCommunityError(error);
  return data as T;
}

export type CommunityInput = { name: string; description: string; imagePath: string | null; isPrivate: boolean };

export const createCommunity = (i: CommunityInput) =>
  rpc<string>("create_community", { p_name: i.name, p_description: i.description, p_image_path: i.imagePath, p_is_private: i.isPrivate });
export const updateCommunity = (id: string, i: Omit<CommunityInput, "isPrivate">) =>
  rpc<void>("update_community", { p_community: id, p_name: i.name, p_description: i.description, p_image_path: i.imagePath });
export const joinCommunity = (id: string) => rpc<CommunityRole>("join_community", { p_community: id });
export const leaveCommunity = (id: string) => rpc<void>("leave_community", { p_community: id });
export const deleteCommunity = (id: string) => rpc<void>("delete_community", { p_community: id });
export const inviteToCommunity = (id: string, userId: string) => rpc<string>("invite_to_community", { p_community: id, p_user: userId });
export const respondToInvite = (inviteId: string, accept: boolean) => rpc<"accepted" | "declined">("respond_to_invite", { p_invite: inviteId, p_accept: accept });
export const cancelInvite = (inviteId: string) => rpc<void>("cancel_invite", { p_invite: inviteId });
export const setMemberRole = (id: string, userId: string, role: "admin" | "member") =>
  rpc<void>("set_member_role", { p_community: id, p_user: userId, p_role: role });
export const removeMember = (id: string, userId: string) => rpc<void>("remove_member", { p_community: id, p_user: userId });
export const transferOwnership = (id: string, userId: string) => rpc<void>("transfer_ownership", { p_community: id, p_user: userId });

export async function fetchMembers(id: string, cursor: MemberCursor | null, limit = 50): Promise<MemberPage> {
  const rows = await rpc<CommunityMember[] | null>("get_community_members", {
    p_community: id,
    p_after_rank: cursor?.rank ?? null,
    p_after_name: cursor?.name ?? null,
    p_limit: limit,
  });
  const list = rows ?? [];
  const last = list[list.length - 1];
  return { members: list, nextCursor: list.length === limit && last ? { rank: last.role_rank, name: last.username } : null };
}

export async function fetchCommunityInvites(id: string): Promise<PendingInvite[]> {
  return (await rpc<PendingInvite[] | null>("get_community_invites", { p_community: id })) ?? [];
}

// ---------------------------------------------------------------- discussion
export async function fetchMessages(id: string, cursor: MessageCursor | null, limit = MESSAGE_PAGE): Promise<MessagePage> {
  const rows =
    (await rpc<MessageRow[] | null>("get_community_messages", {
      p_community: id,
      p_before_created: cursor?.createdAt ?? null,
      p_before_id: cursor?.id ?? null,
      p_limit: limit,
    })) ?? [];
  const urls = await signPaths(rows.map((r) => r.attachment_path));
  const messages: CommunityMessage[] = rows.map((r) => ({ ...r, attachment: attachmentOf(r, urls) }));
  const last = rows[rows.length - 1];
  return { messages, nextCursor: rows.length === limit && last ? { createdAt: last.created_at, id: last.id } : null };
}

export async function fetchPinned(id: string): Promise<PinnedMessage[]> {
  return (await rpc<PinnedMessage[] | null>("get_pinned_messages", { p_community: id })) ?? [];
}

export async function fetchStarred(id: string, cursor: MessageCursor | null, limit = 30): Promise<StarredPage> {
  const rows =
    (await rpc<StarredRow[] | null>("get_starred_messages", {
      p_community: id,
      p_before_starred: cursor?.createdAt ?? null,
      p_before_id: cursor?.id ?? null,
      p_limit: limit,
    })) ?? [];
  const urls = await signPaths(rows.map((r) => r.attachment_path));
  const last = rows[rows.length - 1];
  return {
    messages: rows.map((r) => ({ ...r, attachment: attachmentOf(r, urls) })),
    nextCursor: rows.length === limit && last ? { createdAt: last.starred_at, id: last.id } : null,
  };
}

/** Uploads the attachment (if any), then posts the message; a failed post removes the upload. */
export async function sendMessage(communityId: string, userId: string, body: string, file: PickedAttachment | null): Promise<void> {
  requireSupabaseConfig();
  let path: string | null = null;
  try {
    if (file) path = await uploadAttachment(communityId, userId, file, "msg");
    const { error } = await supabase.from("community_messages").insert({
      community_id: communityId,
      author_id: userId,
      body: body.trim(),
      attachment_path: path,
      attachment_kind: file?.kind ?? null,
      attachment_name: file ? file.name : null,
      attachment_width: file?.kind === "image" ? file.width : null,
      attachment_height: file?.kind === "image" ? file.height : null,
    });
    if (error) throw error;
  } catch (error) {
    await removeAttachment(path);
    throw toCommunityError(error);
  }
}

/** Deletes a message (yours, or anyone's if you're an admin/owner). */
export async function deleteMessage(messageId: string, ownAttachment: string | null): Promise<void> {
  requireSupabaseConfig();
  const { data, error } = await supabase.from("community_messages").delete().eq("id", messageId).select("id");
  if (error) throw toCommunityError(error);
  if (!data || data.length === 0) throw new CommunityError("You can only delete your own messages.");
  await removeAttachment(ownAttachment);
}

export async function setStar(messageId: string, starred: boolean): Promise<void> {
  requireSupabaseConfig();
  const { error } = starred
    ? await supabase.from("community_message_stars").upsert({ message_id: messageId }, { onConflict: "message_id,user_id", ignoreDuplicates: true })
    : await supabase.from("community_message_stars").delete().eq("message_id", messageId);
  if (error) throw toCommunityError(error);
}

export async function setPin(messageId: string, pinned: boolean): Promise<void> {
  requireSupabaseConfig();
  if (pinned) {
    const { error } = await supabase.from("community_message_pins").upsert({ message_id: messageId }, { onConflict: "message_id", ignoreDuplicates: true });
    if (error) throw toCommunityError(error);
  } else {
    const { data, error } = await supabase.from("community_message_pins").delete().eq("message_id", messageId).select("message_id");
    if (error) throw toCommunityError(error);
    if (!data || data.length === 0) throw new CommunityError("Only the owner and admins can unpin messages.");
  }
}

// ---------------------------------------------------------------- content
export type FeedItem = { kind: "content"; item: ContentItem } | { kind: "post"; post: Post };
export type FeedCursor = { createdAt: string; id: string };
export type FeedPage = { items: FeedItem[]; nextCursor: FeedCursor | null };

function contentFromRow(r: FeedRow, communityId: string, urls: Map<string, string>): ContentItem {
  return {
    id: r.id,
    community_id: communityId,
    author_id: r.author_id,
    author_username: r.author_username,
    author_display_name: r.author_display_name,
    author_avatar_path: r.author_avatar_path,
    author_is_member: r.author_is_member,
    title: r.title,
    body: r.body,
    created_at: r.created_at,
    updated_at: r.updated_at,
    attachment: attachmentOf(r, urls),
  };
}

function postFromRow(r: FeedRow): PostRow {
  return {
    id: r.id,
    author_id: r.author_id,
    author_username: r.author_username,
    author_display_name: r.author_display_name,
    author_avatar_path: r.author_avatar_path,
    type: (r.post_type ?? "story") as PostType,
    category: r.post_category ?? "community",
    title: r.title,
    body: r.body,
    location: r.post_location,
    event_at: r.post_event_at,
    like_count: r.like_count ?? 0,
    comment_count: r.comment_count ?? 0,
    created_at: r.created_at,
    updated_at: r.updated_at,
    media_path: r.media_path,
    media_width: r.media_width,
    media_height: r.media_height,
    liked_by_me: Boolean(r.liked_by_me),
    saved_by_me: Boolean(r.saved_by_me),
  };
}

export async function fetchFeed(communityId: string, filter: FeedFilter, cursor: FeedCursor | null, limit = COMMUNITY_PAGE): Promise<FeedPage> {
  const rows =
    (await rpc<FeedRow[] | null>("get_community_feed", {
      p_community: communityId,
      p_filter: filter,
      p_before_created: cursor?.createdAt ?? null,
      p_before_id: cursor?.id ?? null,
      p_limit: limit,
    })) ?? [];
  const [urls, posts] = await Promise.all([
    signPaths(rows.filter((r) => r.item_type === "content").map((r) => r.attachment_path)),
    withMediaUrls(rows.filter((r) => r.item_type === "post").map(postFromRow)),
  ]);
  const postById = new Map(posts.map((p) => [p.id, p]));
  const items: FeedItem[] = rows.map((r) =>
    r.item_type === "post" ? { kind: "post", post: postById.get(r.id)! } : { kind: "content", item: contentFromRow(r, communityId, urls) },
  );
  const last = rows[rows.length - 1];
  return { items, nextCursor: rows.length === limit && last ? { createdAt: last.created_at, id: last.id } : null };
}

/** One content item, or null if it's gone or you can't read the community. */
export async function fetchContentItem(contentId: string): Promise<ContentItem | null> {
  requireSupabaseConfig();
  const { data, error } = await supabase
    .from("community_content")
    .select(
      "id, community_id, author_id, title, body, created_at, updated_at, attachment_path, attachment_kind, attachment_name, attachment_size, attachment_width, attachment_height, author:profiles(username, display_name, avatar_path)",
    )
    .eq("id", contentId)
    .maybeSingle();
  if (error) throw toCommunityError(error);
  if (!data) return null;
  const row = data as unknown as AttachmentColumns & {
    id: string;
    community_id: string;
    author_id: string;
    title: string;
    body: string;
    created_at: string;
    updated_at: string;
    author: { username: string; display_name: string; avatar_path: string | null } | null;
  };
  const [{ data: member }, urls] = await Promise.all([
    supabase.from("community_members").select("status").eq("community_id", row.community_id).eq("user_id", row.author_id).maybeSingle(),
    signPaths([row.attachment_path]),
  ]);
  return {
    id: row.id,
    community_id: row.community_id,
    author_id: row.author_id,
    author_username: row.author?.username ?? "",
    author_display_name: row.author?.display_name ?? "Former member",
    author_avatar_path: row.author?.avatar_path ?? null,
    author_is_member: (member as { status?: string } | null)?.status === "active",
    title: row.title,
    body: row.body,
    created_at: row.created_at,
    updated_at: row.updated_at,
    attachment: attachmentOf(row, urls),
  };
}

export type ContentInput = { title: string; body: string; file: PickedAttachment | null };

export async function addContent(communityId: string, userId: string, input: ContentInput): Promise<string> {
  requireSupabaseConfig();
  let path: string | null = null;
  try {
    if (input.file) path = await uploadAttachment(communityId, userId, input.file, "content");
    const f = input.file;
    const { data, error } = await supabase
      .from("community_content")
      .insert({
        community_id: communityId,
        author_id: userId,
        title: input.title.trim(),
        body: input.body.trim(),
        attachment_path: path,
        attachment_kind: f?.kind ?? null,
        attachment_name: f ? f.name : null,
        attachment_width: f?.kind === "image" ? f.width : null,
        attachment_height: f?.kind === "image" ? f.height : null,
      })
      .select("id")
      .single();
    if (error) throw error;
    return (data as { id: string }).id;
  } catch (error) {
    await removeAttachment(path);
    throw toCommunityError(error);
  }
}

export async function deleteContent(contentId: string, ownAttachment: string | null): Promise<void> {
  requireSupabaseConfig();
  const { data, error } = await supabase.from("community_content").delete().eq("id", contentId).select("id");
  if (error) throw toCommunityError(error);
  if (!data || data.length === 0) throw new CommunityError("You can only delete your own content.");
  await removeAttachment(ownAttachment);
}
