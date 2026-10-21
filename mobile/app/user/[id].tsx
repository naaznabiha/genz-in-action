import { Redirect, useLocalSearchParams } from "expo-router";

import ProfileView from "@/components/profile/profile-view";
import { useAuth } from "@/hooks/use-auth";

/** Another user's profile (spec §5.6, FR-10/11/20). Your own id redirects to the Profile tab. */
export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  if (!id) return null;
  if (user?.id === id) return <Redirect href="/profile" />;
  return <ProfileView userId={id} isOwn={false} />;
}
