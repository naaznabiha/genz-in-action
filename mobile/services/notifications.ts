import { toPostError } from "@/lib/post-errors";
import { requireSupabaseConfig, supabase } from "@/lib/supabase";
import { PAGE_SIZE, withMediaUrls } from "@/services/posts";
import type { MyPostList, NotificationCursor, NotificationItem, NotificationPage } from "@/types/notification";
import type { PostCursor, PostPage, PostRow } from "@/types/post";

/**
 * Notifications (spec FR-15) and the Saved tab's Saved / Liked lists (FR-19).
 * Notifications are created only by database triggers; these calls read the
 * caller's own rows and mark them read. Privacy (own rows only, nothing from
 * blocked people) is enforced in the database. Phase 6: the list comes from
 * get_notification_list (Phase 5 columns + community details).
 */
const NOTIFICATION_PAGE = 30;

export async function fetchNotifications(cursor: NotificationCursor | null, limit = NOTIFICATION_PAGE): Promise<NotificationPage> {
  requireSupabaseConfig();
  const { data, error } = await supabase.rpc("get_notification_list", {
    p_before_at: cursor?.createdAt ?? null,
    p_before_key: cursor?.key ?? null,
    p_limit: limit,
  });
  if (error) throw toPostError(error);
  const items = (data ?? []) as NotificationItem[];
  const last = items[items.length - 1];
  return { items, nextCursor: items.length === limit && last ? { createdAt: last.created_at, key: last.key } : null };
}

/** Unread items (a group of likes counts once) — the bell badge. */
export async function fetchUnreadCount(): Promise<number> {
  requireSupabaseConfig();
  const { data, error } = await supabase.rpc("get_unread_notification_count");
  if (error) throw toPostError(error);
  return (data as number | null) ?? 0;
}

/** Marks one item read (for a likes group: every like in it). */
export async function markNotificationRead(key: string): Promise<void> {
  requireSupabaseConfig();
  const { error } = await supabase.rpc("mark_notification_read", { p_key: key });
  if (error) throw toPostError(error);
}

export async function markAllNotificationsRead(): Promise<void> {
  requireSupabaseConfig();
  const { error } = await supabase.rpc("mark_all_notifications_read");
  if (error) throw toPostError(error);
}

/** One page of the posts you saved or liked (most recent first) that you can still see. */
export async function fetchMyPostList(list: MyPostList, cursor: PostCursor | null, limit = PAGE_SIZE): Promise<PostPage> {
  requireSupabaseConfig();
  const { data, error } = await supabase.rpc("get_my_post_list", {
    p_list: list,
    p_before_at: cursor?.createdAt ?? null,
    p_before_id: cursor?.id ?? null,
    p_limit: limit,
  });
  if (error) throw toPostError(error);
  const rows = (data ?? []) as (PostRow & { listed_at: string })[];
  const posts = await withMediaUrls(rows);
  const last = rows[rows.length - 1];
  // For these lists the cursor's createdAt is when YOU saved/liked the post.
  return { posts, nextCursor: rows.length === limit && last ? { createdAt: last.listed_at, id: last.id } : null };
}
