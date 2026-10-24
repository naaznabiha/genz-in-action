import { Tabs } from "expo-router";

import BottomTabBar from "@/components/navigation/bottom-tab-bar";
import { useNotificationSync } from "@/hooks/use-notifications";

/**
 * Five-tab navigation from spec §4: Home, Explore, Create, Saved, Profile.
 * The bar itself is a port of the prototype's BottomNav (components/navigation/bottom-tab-bar.tsx).
 */
export default function TabLayout() {
  // Signed-in area: keep the notification badge live (Realtime) while the app is open.
  useNotificationSync();
  return (
    <Tabs tabBar={(props) => <BottomTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="explore" options={{ title: "Explore" }} />
      <Tabs.Screen name="create" options={{ title: "Create" }} />
      <Tabs.Screen name="saved" options={{ title: "Saved" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
