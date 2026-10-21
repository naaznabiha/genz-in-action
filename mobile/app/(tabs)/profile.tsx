import ProfileView from "@/components/profile/profile-view";
import { useAuth } from "@/hooks/use-auth";

/** Own profile tab (spec FR-16, FR-17). Always the signed-in user — no id is taken from the route. */
export default function ProfileScreen() {
  const { user } = useAuth();
  if (!user) return null;
  return <ProfileView userId={user.id} isOwn />;
}
