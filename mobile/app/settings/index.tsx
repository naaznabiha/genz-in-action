import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { BellIcon, CheckVerifiedIcon, EditIcon, EyeIcon, GlobeIcon, LogOutIcon, ShieldIcon } from "@/components/icons";
import { SettingRow, SettingSection } from "@/components/settings/setting-row";
import AppText from "@/components/ui/app-text";
import Avatar from "@/components/ui/avatar";
import BottomSheet from "@/components/ui/bottom-sheet";
import Button from "@/components/ui/button";
import Screen from "@/components/ui/screen";
import ScreenHeader from "@/components/ui/screen-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { Colors, Radius, Spacing } from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";
import { useMyProfile } from "@/hooks/use-profile";
import { useMySettings, useSetNotifyActivity, useSetPrivateAccount } from "@/hooks/use-settings";
import { useFollowRequests } from "@/hooks/use-social";
import { avatarPublicUrl } from "@/services/profile";

/**
 * Settings (spec FR-19; prototype SettingsScreen).
 * Only working controls are actionable. Get Verified and Language are labelled
 * "Coming soon" (spec §18 verification undefined; no localisation yet).
 * Push / email notification switches and Data Sharing are intentionally absent
 * (not MVP / no defined purpose — decision D18). Private Account is enforced by
 * the database from Phase 3 (follow approval, hidden posts).
 */
export default function SettingsScreen() {
  const router = useRouter();
  const toast = useToast();
  const { signOut } = useAuth();
  const profile = useMyProfile();
  const settings = useMySettings();
  const setNotify = useSetNotifyActivity();
  const setPrivate = useSetPrivateAccount();
  const requests = useFollowRequests();
  const requestCount = requests.data?.length ?? 0;
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const onToggleNotify = (value: boolean) =>
    setNotify.mutate(value, {
      onError: (e) => toast.show(e instanceof Error ? e.message : "Couldn't save your notification setting.", "error"),
    });

  const onTogglePrivate = (value: boolean) =>
    setPrivate.mutate(value, {
      onSuccess: () =>
        toast.show(
          value ? "Your account is now private" : "Your account is now public. Pending requests were accepted.",
          "success",
        ),
      onError: (e) => toast.show(e instanceof Error ? e.message : "Couldn't save your privacy setting.", "error"),
    });

  const handleLogout = async () => {
    setSigningOut(true);
    try {
      await signOut();
      // The root session gate now routes to Welcome; this screen unmounts.
    } catch {
      // The local session is cleared even if the server call fails (offline).
      toast.show("Signed out on this device.", "info");
    } finally {
      setSigningOut(false);
      setConfirmLogout(false);
    }
  };

  const p = profile.data;

  return (
    <Screen scroll header={<ScreenHeader title="Settings" back />} edges={["top", "bottom"]} padded={false} contentStyle={styles.content}>
      {/* Account summary */}
      <Pressable
        onPress={() => router.push("/settings/edit-profile")}
        accessibilityRole="button"
        accessibilityLabel="Edit profile"
        style={({ pressed }) => [styles.summary, pressed && { opacity: 0.85 }]}
      >
        {p ? (
          <>
            <Avatar name={p.display_name} uri={avatarPublicUrl(p.avatar_path)} size={52} />
            <View style={styles.flex}>
              <AppText variant="bodyBold" numberOfLines={1}>
                {p.display_name}
              </AppText>
              <AppText variant="body" color={Colors.text2} numberOfLines={1}>
                @{p.username}
              </AppText>
            </View>
          </>
        ) : (
          <>
            <Skeleton width={52} height={52} radius={26} />
            <View style={[styles.flex, { gap: 6 }]}>
              <Skeleton width="60%" height={14} />
              <Skeleton width="40%" height={12} />
            </View>
          </>
        )}
      </Pressable>

      <SettingSection title="Account">
        <SettingRow
          kind="link"
          icon={<EditIcon size={16} color={Colors.cyan} />}
          label="Edit Profile"
          subtitle="Update your name, bio, tags and photo"
          onPress={() => router.push("/settings/edit-profile")}
        />
        <SettingRow kind="soon" icon={<CheckVerifiedIcon size={16} color={Colors.text3} />} label="Get Verified" subtitle="Verified badges are not available yet" />
        <SettingRow kind="soon" icon={<GlobeIcon size={16} color={Colors.text3} />} label="Language" subtitle="English only for now" />
      </SettingSection>

      <SettingSection
        title="Notifications"
        footnote="In-app notifications arrive in a later update. Your choice is saved now and applies when they launch."
      >
        {settings.isError ? (
          <ErrorRow message={settings.error.message} onRetry={() => void settings.refetch()} />
        ) : (
          <SettingRow
            kind="toggle"
            icon={<BellIcon size={16} color="#FB923C" />}
            label="Activity Updates"
            subtitle="Likes, comments and new followers"
            value={settings.data?.notify_activity ?? true}
            disabled={!settings.data || setNotify.isPending}
            onValueChange={onToggleNotify}
          />
        )}
      </SettingSection>

      <SettingSection
        title="Privacy & Security"
        footnote="Private: only people you approve can see your posts. Switching back to public accepts all pending requests."
      >
        <SettingRow
          kind="toggle"
          icon={<EyeIcon size={16} color={Colors.gold} />}
          label="Private Account"
          subtitle="Only approved followers can see your posts"
          value={p?.is_private ?? false}
          disabled={!p || setPrivate.isPending}
          onValueChange={onTogglePrivate}
        />
        <SettingRow
          kind="link"
          icon={<ShieldIcon size={16} color={Colors.gold} />}
          label="Follow Requests"
          subtitle={requests.isPending ? "Loading…" : requestCount === 0 ? "No pending requests" : `${requestCount} waiting for approval`}
          onPress={() => router.push("/settings/follow-requests")}
        />
        <SettingRow
          kind="link"
          icon={<ShieldIcon size={16} color={Colors.red} />}
          label="Blocked Users"
          subtitle="People you've blocked"
          onPress={() => router.push("/settings/blocked-users")}
        />
      </SettingSection>

      <SettingSection title="Support">
        <SettingRow kind="link" icon={<AppText>❓</AppText>} label="Help & FAQ" onPress={() => router.push("/settings/help")} />
        <SettingRow kind="link" icon={<AppText>📄</AppText>} label="Terms of Service" onPress={() => router.push("/legal/terms")} />
        <SettingRow kind="link" icon={<AppText>🔒</AppText>} label="Privacy Policy" onPress={() => router.push("/legal/privacy")} />
      </SettingSection>

      <SettingSection>
        <SettingRow kind="link" danger icon={<LogOutIcon size={16} color={Colors.red} />} label="Log Out" onPress={() => setConfirmLogout(true)} />
      </SettingSection>

      <AppText variant="caption" color={Colors.text3} align="center" style={styles.version}>
        GenZ in Action v{Constants.expoConfig?.version ?? "1.0.0"}
      </AppText>

      <BottomSheet
        visible={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        dismissible={!signingOut}
        title="Log out?"
        message="You will need to log in again to access your account."
      >
        <Button label="Yes, Log Out" variant="danger" fullWidth loading={signingOut} onPress={handleLogout} />
        <Button label="Cancel" variant="secondary" fullWidth disabled={signingOut} onPress={() => setConfirmLogout(false)} />
      </BottomSheet>
    </Screen>
  );
}

function ErrorRow({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.errorRow}>
      <AppText variant="caption" color={Colors.red} style={styles.flex}>
        {message}
      </AppText>
      <Button label="Retry" onPress={onRetry} variant="secondary" size="sm" />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: Spacing.xxxl },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
    padding: Spacing.lg,
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.xl,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.hairline,
  },
  flex: { flex: 1, minWidth: 0 },
  errorRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md, padding: Spacing.lg },
  version: { marginTop: Spacing.sm },
});
