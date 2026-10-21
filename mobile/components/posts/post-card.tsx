import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { memo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import {
  BookmarkFilledIcon,
  BookmarkIcon,
  CalendarIcon,
  ChatBubbleIcon,
  DotsIcon,
  HeartFilledIcon,
  HeartIcon,
  MapPinIcon,
  ShareIcon,
} from "@/components/icons";
import CategoryTag from "@/components/posts/category-tag";
import PostBodyText from "@/components/posts/post-body-text";
import PostOwnerMenu from "@/components/posts/post-owner-menu";
import TypeBadge from "@/components/posts/type-badge";
import AppText from "@/components/ui/app-text";
import Avatar from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";
import { Colors, FontFamily, Radius, Spacing } from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";
import { useToggleLike, useToggleSave } from "@/hooks/use-posts";
import { sharePost } from "@/lib/share";
import { formatCount, formatEventDate, isEdited, relativeTime } from "@/lib/time";
import { avatarPublicUrl } from "@/services/profile";
import type { Post } from "@/types/post";

type PostCardProps = {
  post: Post;
  /** Preview mode (composer): no navigation, no actions. */
  preview?: boolean;
};

/** Port of the prototype's PostCard, backed by real data. */
function PostCard({ post, preview = false }: PostCardProps) {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const toggleLike = useToggleLike();
  const toggleSave = useToggleSave();
  const [menuOpen, setMenuOpen] = useState(false);
  const isMine = user?.id === post.author_id;

  const openPost = () => {
    if (!preview) router.push({ pathname: "/post/[id]", params: { id: post.id } });
  };
  const openAuthor = () => {
    if (preview) return;
    if (isMine) router.navigate("/profile");
    else router.push({ pathname: "/user/[id]", params: { id: post.author_id } });
  };
  const share = async () => {
    const ok = await sharePost(post);
    if (!ok) toast.show("Sharing isn't available on this device.", "info");
  };

  const badges = (
    <View style={styles.badges}>
      <TypeBadge type={post.type} />
      <CategoryTag category={post.category} />
    </View>
  );

  return (
    <Pressable
      onPress={openPost}
      disabled={preview}
      accessibilityRole={preview ? undefined : "button"}
      accessibilityLabel={`${post.title}, by ${post.author_display_name}`}
      style={({ pressed }) => [styles.card, pressed && !preview && styles.pressed]}
    >
      {post.media_url ? (
        <View>
          <Image source={{ uri: post.media_url }} style={styles.image} contentFit="cover" transition={150} accessibilityIgnoresInvertColors />
          <View style={styles.imageBadges}>{badges}</View>
        </View>
      ) : null}

      <View style={styles.body}>
        {!post.media_url ? badges : null}

        <View style={styles.authorRow}>
          <Avatar name={post.author_display_name} uri={avatarPublicUrl(post.author_avatar_path)} size={32} onPress={preview ? undefined : openAuthor} />
          <View style={styles.flex}>
            <AppText variant="bodySemiBold" numberOfLines={1}>
              {post.author_display_name}
            </AppText>
            <AppText variant="caption" color={Colors.text2} numberOfLines={1}>
              @{post.author_username} · {relativeTime(post.created_at)}
              {isEdited(post.created_at, post.updated_at) ? " · Edited" : ""}
            </AppText>
          </View>
          {isMine && !preview ? (
            <Pressable onPress={() => setMenuOpen(true)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Post options" style={styles.menuButton}>
              <DotsIcon size={18} color={Colors.text2} />
            </Pressable>
          ) : null}
        </View>

        <AppText style={styles.title}>{post.title}</AppText>
        <PostBodyText text={post.body} numberOfLines={preview ? undefined : 3} />

        {post.event_at || post.location ? (
          <View style={styles.meta}>
            {post.event_at ? (
              <View style={styles.metaItem}>
                <CalendarIcon size={13} color={Colors.cyan} />
                <AppText variant="caption" color={Colors.cyan}>
                  {formatEventDate(post.event_at)}
                </AppText>
              </View>
            ) : null}
            {post.location ? (
              <View style={styles.metaItem}>
                <MapPinIcon size={13} color={Colors.text2} />
                <AppText variant="caption" color={Colors.text2}>
                  {post.location}
                </AppText>
              </View>
            ) : null}
          </View>
        ) : null}

        {!preview ? (
          <View style={styles.actions}>
            <View style={styles.actionGroup}>
              <Pressable
                onPress={() => void toggleLike(post)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={post.liked_by_me ? "Unlike" : "Like"}
                accessibilityState={{ selected: post.liked_by_me }}
                style={styles.action}
              >
                {post.liked_by_me ? <HeartFilledIcon size={18} color={Colors.red} /> : <HeartIcon size={18} color={Colors.text2} />}
                <AppText style={styles.count} color={post.liked_by_me ? Colors.red : Colors.text2}>
                  {formatCount(post.like_count)}
                </AppText>
              </Pressable>
              <Pressable onPress={openPost} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${post.comment_count} comments`} style={styles.action}>
                <ChatBubbleIcon size={18} color={Colors.text2} />
                <AppText style={styles.count} color={Colors.text2}>
                  {formatCount(post.comment_count)}
                </AppText>
              </Pressable>
              <Pressable onPress={share} hitSlop={8} accessibilityRole="button" accessibilityLabel="Share" style={styles.action}>
                <ShareIcon size={18} color={Colors.text2} />
              </Pressable>
            </View>
            <Pressable
              onPress={() => void toggleSave(post)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={post.saved_by_me ? "Remove from saved" : "Save"}
              accessibilityState={{ selected: post.saved_by_me }}
            >
              {post.saved_by_me ? <BookmarkFilledIcon size={18} color={Colors.cyan} /> : <BookmarkIcon size={18} color={Colors.text2} />}
            </Pressable>
          </View>
        ) : null}
      </View>

      {isMine && !preview ? <PostOwnerMenu post={post} visible={menuOpen} onClose={() => setMenuOpen(false)} /> : null}
    </Pressable>
  );
}

export default memo(PostCard);

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.hairline,
    overflow: "hidden",
  },
  pressed: { transform: [{ scale: 0.99 }] },
  image: { width: "100%", aspectRatio: 16 / 9, backgroundColor: Colors.elevated },
  imageBadges: { position: "absolute", top: Spacing.md, left: Spacing.md },
  body: { padding: Spacing.lg, gap: Spacing.sm },
  badges: { flexDirection: "row", gap: 6, alignItems: "center" },
  authorRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md, marginTop: Spacing.xs },
  flex: { flex: 1, minWidth: 0 },
  menuButton: { padding: 4 },
  title: { fontFamily: FontFamily.displayBold, fontSize: 16, lineHeight: 22, color: Colors.text1 },
  meta: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.md },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.xs,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  actionGroup: { flexDirection: "row", gap: Spacing.lg },
  action: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 28 },
  count: { fontFamily: FontFamily.medium, fontSize: 12, lineHeight: 16 },
});
