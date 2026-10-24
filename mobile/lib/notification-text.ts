import type { NotificationItem } from "@/types/notification";

/** What the row says, split so the actor's name can be bold. */
export function describeNotification(n: NotificationItem): { lead: string; rest: string } {
  const others = n.actor_count - 1;
  const lead = others > 0 ? `${n.actor_display_name} and ${others} ${others === 1 ? "other" : "others"}` : n.actor_display_name;
  const title = n.post_title ? ` “${n.post_title}”` : "";
  switch (n.type) {
    case "like":
      return { lead, rest: ` liked your post${title}` };
    case "comment":
      return { lead, rest: ` commented on${title || " your post"}${n.comment_excerpt ? `: “${n.comment_excerpt}”` : ""}` };
    case "follow":
      return { lead, rest: " started following you" };
    case "follow_request":
      return { lead, rest: " asked to follow you · tap to review" };
    case "follow_accepted":
      return { lead, rest: " accepted your follow request" };
    default:
      return { lead, rest: " sent you an update" }; // community types arrive with Phase 6
  }
}
