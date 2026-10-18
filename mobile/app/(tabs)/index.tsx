import PlaceholderScreen from "@/components/placeholder-screen";
import { useMyProfile } from "@/hooks/use-profile";

/** Phase 1: proves the signed-in user's profile loads (greeting). Full dashboard arrives in Phase 2. */
export default function HomeScreen() {
  const { data: profile } = useMyProfile();
  const firstName = profile?.display_name.trim().split(/\s+/)[0];
  return <PlaceholderScreen title={firstName ? `Hi, ${firstName}` : "Home"} plannedFor="Phase 2 — Profile and dashboard" />;
}
