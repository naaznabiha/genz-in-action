import type { NotificationItem } from "@/types/notification";

/** What the row says, split so the actor's name can be bold. */
export function describeNotification(n: NotificationItem): { lead: string; rest: string } {
  const others = n.actor_count - 1;
  const lead = others > 0 ? `${n.actor_display_name} and ${others} ${others === 1 ? "other" : "others"}` : n.actor_display_name;
  const title = n.post_title ? ` “${n.post_title}”` : "";
  const community = n.community_name ?? "a community";
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
    case "community_invite":
      return {
        lead,
        rest:
          ` invited you to join ${community}` +
          (n.invite_status === "accepted" ? " · you joined" : n.invite_status === "declined" ? " · declined" : n.invite_status === "cancelled" ? " · no longer available" : ""),
      };
    case "community_invite_accepted":
      return { lead, rest: ` accepted your invite to ${community}` };
    case "community_invite_declined":
      return { lead, rest: ` declined your invite to ${community}` };
    case "community_role":
      return { lead, rest: ` made you an admin of ${community}` };
    case "community_owner":
      return { lead, rest: ` made you the owner of ${community}` };
    case "community_content":
      return { lead, rest: ` added ${n.content_title ? `“${n.content_title}”` : "new content"} to ${community}` };
    default:
      return { lead, rest: " sent you an update" };
  }
}
