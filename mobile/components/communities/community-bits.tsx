import { Image } from "expo-image";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import AppText from "@/components/ui/app-text";
import { useToast } from "@/components/ui/toast";
import { Colors, FontFamily, Radius, Spacing } from "@/constants/theme";
import { formatBytes } from "@/lib/attachments";
import { communityImageUrl, signAttachment } from "@/services/communities";
import type { Attachment, CommunityRole } from "@/types/community";

const TILE_COLORS = ["#00BFBF", "#A78BFA", "#4ADE80", "#FBBF24", "#F472B6", "#60A5FA", "#FB923C", "#22D3EE"];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[1][0] : "")).toUpperCase();
}

function tileColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return TILE_COLORS[h % TILE_COLORS.length];
}

/** Rounded-square community image, or coloured initials when it has none. */
export function CommunityAvatar({ name, id, imagePath, size = 48 }: { name: string; id: string; imagePath: string | null; size?: number }) {
  const uri = communityImageUrl(imagePath);
  const box = { width: size, height: size, borderRadius: size * 0.28 };
  if (uri) return <Image source={{ uri }} style={[box, styles.tileImage]} contentFit="cover" accessibilityIgnoresInvertColors accessibilityLabel={`${name} image`} />;
  const c = tileColor(id);
  return (
    <View style={[box, styles.tile, { backgroundColor: `${c}26`, borderColor: `${c}55` }]} accessible accessibilityLabel={`${name} image`}>
      <AppText style={{ fontFamily: FontFamily.displayBlack, fontSize: size * 0.34, lineHeight: size * 0.42 }} color={c}>
        {initials(name)}
      </AppText>
    </View>
  );
}

/** PUBLIC / PRIVATE · INVITE ONLY. */
export function PrivacyChip({ isPrivate, short = false }: { isPrivate: boolean; short?: boolean }) {
  return (
    <View style={[styles.chip, isPrivate ? styles.chipPrivate : styles.chipPublic]}>
      <AppText style={styles.chipText} color={isPrivate ? Colors.gold : Colors.cyan}>
        {isPrivate ? (short ? "PRIVATE" : "PRIVATE · INVITE ONLY") : "PUBLIC"}
      </AppText>
    </View>
  );
}

const ROLE_COLORS: Record<CommunityRole, string> = { owner: Colors.gold, admin: "#A78BFA", member: Colors.text2 };

export function RoleChip({ role }: { role: CommunityRole }) {
  const c = ROLE_COLORS[role];
  return (
    <View style={[styles.chip, { borderColor: `${c}66`, backgroundColor: `${c}1A` }]}>
      <AppText style={styles.chipText} color={c}>
        {role.toUpperCase()}
      </AppText>
    </View>
  );
}

/** A photo (tap: full size) or a PDF card (tap: opens it). */
export function AttachmentView({ attachment, compact = false }: { attachment: Attachment; compact?: boolean }) {
  const toast = useToast();
  const [opening, setOpening] = useState(false);

  const open = async () => {
    setOpening(true);
    try {
      const url = await signAttachment(attachment.path); // always fresh: page URLs expire after an hour
      await WebBrowser.openBrowserAsync(url);
    } catch (error) {
      toast.show(error instanceof Error ? error.message : "Couldn't open the file.", "error");
    } finally {
      setOpening(false);
    }
  };

  if (attachment.kind === "image") {
    const ratio = attachment.width && attachment.height ? attachment.width / attachment.height : 4 / 3;
    return (
      <Pressable onPress={open} accessibilityRole="imagebutton" accessibilityLabel="Open photo">
        {attachment.url ? (
          <Image
            source={{ uri: attachment.url }}
            style={[styles.photo, { aspectRatio: Math.min(2, Math.max(0.6, ratio)) }, compact && styles.photoCompact]}
            contentFit="cover"
            transition={150}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View style={[styles.photo, styles.photoMissing]}>
            <AppText variant="caption" color={Colors.text3}>
              Photo unavailable
            </AppText>
          </View>
        )}
      </Pressable>
    );
  }
  return (
    <Pressable
      onPress={open}
      disabled={opening}
      accessibilityRole="button"
      accessibilityLabel={`Open ${attachment.name ?? "document"}, PDF ${formatBytes(attachment.size)}`}
      style={({ pressed }) => [styles.pdf, pressed && { opacity: 0.8 }]}
    >
      <View style={styles.pdfIcon}>
        <AppText style={styles.pdfIconText} color={Colors.red}>
          PDF
        </AppText>
      </View>
      <View style={styles.flex}>
        <AppText variant="bodySemiBold" numberOfLines={1}>
          {attachment.name ?? "Document.pdf"}
        </AppText>
        <AppText variant="caption" color={Colors.text3}>
          PDF{attachment.size ? ` · ${formatBytes(attachment.size)}` : ""}
        </AppText>
      </View>
      {opening ? <ActivityIndicator color={Colors.cyan} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: "center", justifyContent: "center", borderWidth: 1 },
  tileImage: { backgroundColor: Colors.elevated },
  chip: { borderRadius: Radius.full, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2, alignSelf: "flex-start" },
  chipPublic: { borderColor: "rgba(0,255,255,0.35)", backgroundColor: "rgba(0,255,255,0.08)" },
  chipPrivate: { borderColor: "rgba(255,215,0,0.4)", backgroundColor: "rgba(255,215,0,0.08)" },
  chipText: { fontFamily: FontFamily.bold, fontSize: 10, lineHeight: 14, letterSpacing: 0.6 },
  photo: { width: "100%", borderRadius: Radius.md, backgroundColor: Colors.elevated },
  photoCompact: { maxHeight: 220 },
  photoMissing: { aspectRatio: 4 / 3, alignItems: "center", justifyContent: "center" },
  pdf: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.deep,
    borderWidth: 1,
    borderColor: Colors.hairline,
  },
  pdfIcon: { width: 40, height: 44, borderRadius: 8, backgroundColor: Colors.redSurface, alignItems: "center", justifyContent: "center" },
  pdfIconText: { fontFamily: FontFamily.bold, fontSize: 11, lineHeight: 14 },
  flex: { flex: 1, minWidth: 0 },
});
