/**
 * Notification shapes (supabase/migrations/20261024100000_notification_rpcs.sql).
 * Rows are created only by database triggers; the app reads them and marks
 * them read. Likes on the same post arrive as ONE item (decision D43).
 */
export type NotificationType = "like" | "comment" | "follow" | "follow_request" | "follow_accepted";

export type NotificationItem = {
  /** 'like:<post id>' for a group of likes, otherwise the notification id. */
  key: string;
  type: NotificationType | string; // future community types arrive as strings until Phase 6 handles them
  target_type: "post" | "comment" | "profile" | string;
  target_id: string;
  /** Post to open for likes and comments. */
  post_id: string | null;
  post_title: string | null;
  comment_excerpt: string | null;
  actor_id: string;
  actor_username: string;
  actor_display_name: string;
  actor_avatar_path: string | null;
  /** How many people are in the item (likes group); 1 otherwise. */
  actor_count: number;
  created_at: string;
  unread: boolean;
};

export type NotificationCursor = { createdAt: string; key: string };
export type NotificationPage = { items: NotificationItem[]; nextCursor: NotificationCursor | null };

export type MyPostList = "saved" | "liked";
