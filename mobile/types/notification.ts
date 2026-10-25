/**
 * Notification shapes (supabase/migrations/20261024100000_notification_rpcs.sql).
 * Rows are created only by database triggers; the app reads them and marks
 * them read. Likes on the same post arrive as ONE item (decision D43).
 * Phase 6 adds community types (get_notification_list,
 * supabase/migrations/20261024120300_community_notifications.sql, D52).
 */
export type NotificationType =
  | "like"
  | "comment"
  | "follow"
  | "follow_request"
  | "follow_accepted"
  | "community_invite"
  | "community_invite_accepted"
  | "community_invite_declined"
  | "community_role"
  | "community_owner"
  | "community_content";

export type NotificationItem = {
  /** 'like:<post id>' for a group of likes, otherwise the notification id. */
  key: string;
  type: NotificationType | string; // an unknown future type still renders (generic text)
  target_type: "post" | "comment" | "profile" | "community" | "community_invite" | "community_content" | string;
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
  /** Community notifications: which community (null for the Phase 5 types). */
  community_id: string | null;
  community_name: string | null;
  community_image_path: string | null;
  /** community_invite: pending / accepted / declined / cancelled. */
  invite_status: string | null;
  /** community_content: the item's title. */
  content_title: string | null;
};

export type NotificationCursor = { createdAt: string; key: string };
export type NotificationPage = { items: NotificationItem[]; nextCursor: NotificationCursor | null };

export type MyPostList = "saved" | "liked";
