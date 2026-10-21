import ComingSoonScreen from "@/components/coming-soon-screen";

/** Notifications (spec FR-15). Placeholder until notifications launch; no fake items or unread counts are shown. */
export default function NotificationsScreen() {
  return (
    <ComingSoonScreen
      title="Notifications"
      emoji="🔔"
      heading="No notifications yet"
      message="Likes, comments, follows and community invites will show up here once those features launch."
    />
  );
}
