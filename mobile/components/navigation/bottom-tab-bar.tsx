import type { BottomTabBarProps } from "expo-router/js-tabs";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import type { ComponentType } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  BookmarkFilledIcon,
  BookmarkIcon,
  CompassFilledIcon,
  CompassIcon,
  HomeFilledIcon,
  HomeIcon,
  PersonFilledIcon,
  PersonIcon,
  PlusIcon,
  type IconProps,
} from "@/components/icons";
import AppText from "@/components/ui/app-text";
import Badge from "@/components/ui/badge";
import { Colors, FontFamily, Radius } from "@/constants/theme";

type TabIcons = { idle: ComponentType<IconProps>; active: ComponentType<IconProps> };

/** Route name (file in app/(tabs)) → prototype icons. */
const ICONS: Record<string, TabIcons> = {
  index: { idle: HomeIcon, active: HomeFilledIcon },
  explore: { idle: CompassIcon, active: CompassFilledIcon },
  saved: { idle: BookmarkIcon, active: BookmarkFilledIcon },
  profile: { idle: PersonIcon, active: PersonFilledIcon },
};

const CREATE_ROUTE = "create";

function tapFeedback() {
  if (Platform.OS === "ios") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/**
 * Port of design-reference/src/components/BottomNav.tsx:
 * four labelled tabs plus a raised gradient "Create" button in the middle.
 * Unread counts come from each screen's `tabBarBadge` option.
 */
export default function BottomTabBar({ state, descriptors, emitter, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.row}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const label = typeof options.title === "string" ? options.title : route.name;

          const onPress = () => {
            tapFeedback();
            const event = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigateToTab(route.key);
          };
          const onLongPress = () => emitter.emit({ type: "tabLongPress", target: route.key });

          if (route.name === CREATE_ROUTE) {
            return (
              <Pressable
                key={route.key}
                onPress={onPress}
                onLongPress={onLongPress}
                accessibilityRole="tab"
                accessibilityLabel="Create post"
                accessibilityState={{ selected: focused }}
                style={({ pressed }) => [styles.createSlot, { transform: [{ scale: pressed ? 0.94 : 1 }] }]}
              >
                <LinearGradient
                  colors={focused ? [Colors.cyanDim, Colors.cyan] : [Colors.cyanDeep, Colors.cyanDim]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.createButton}
                >
                  <PlusIcon size={24} color={Colors.text1} />
                </LinearGradient>
              </Pressable>
            );
          }

          const icons = ICONS[route.name];
          const Icon = focused ? icons?.active : icons?.idle;
          const color = focused ? Colors.cyan : Colors.text3;
          const badge = typeof options.tabBarBadge === "number" ? options.tabBarBadge : 0;

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              onLongPress={onLongPress}
              accessibilityRole="tab"
              accessibilityLabel={badge ? `${label}, ${badge} new` : label}
              accessibilityState={{ selected: focused }}
              style={styles.tab}
            >
              <View>
                {Icon ? <Icon size={24} color={color} /> : null}
                {badge ? (
                  <View style={styles.badge}>
                    <Badge count={badge} />
                  </View>
                ) : null}
              </View>
              <AppText style={styles.label} color={color} maxFontSizeMultiplier={1.2}>
                {label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: Colors.navBar,
    borderTopWidth: 1,
    borderTopColor: Colors.navBorder,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-around",
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  tab: { alignItems: "center", gap: 4, minWidth: 56, minHeight: 44, paddingVertical: 4 },
  label: { fontFamily: FontFamily.medium, fontSize: 10, lineHeight: 13 },
  badge: { position: "absolute", top: -4, right: -6 },
  createSlot: { marginTop: -28, alignItems: "center" },
  createButton: {
    width: 56,
    height: 56,
    borderRadius: Radius.lg,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.cyanDim,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
