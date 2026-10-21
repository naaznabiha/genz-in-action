import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, View } from "react-native";

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
import BottomSheet from "@/components/ui/bottom-sheet";
import Button from "@/components/ui/button";
import EmptyState from "@/components/ui/empty-state";
import IconButton from "@/components/ui/icon-button";
import Screen from "@/components/ui/screen";
import ScreenHeader from "@/components/ui/screen-header";
import { Skeleton } from "@/components/ui/skeleton";
import TextField from "@/components/ui/text-field";
import { useToast } from "@/components/ui/toast";
import { Colors, FontFamily, Radius, Spacing } from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";
import { useMyProfile } from "@/hooks/use-profile";
import { commentKeys, postKeys, useAddComment, useComments, useDeleteComment, useEditComment, usePost, useToggleLike, useToggleSave } from "@/hooks/use-posts";
import { toPostError } from "@/lib/post-errors";
import { sharePost } from "@/lib/share";
import { formatCount, formatEventDate, isEdited, relativeTime } from "@/lib/time";
import { COMMENT_MAX } from "@/lib/validation";
import { avatarPublicUrl } from "@/services/profile";
import type { Comment } from "@/types/post";
import { useQueryClient } from "@tanstack/react-query";

/** Post detail (prototype PostDetailScreen): full post, author, comments and comment box. */
export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const me = useMyProfile();
  const post = usePost(id);
  const comments = useComments(post.data ? id : undefined);
  const toggleLike = useToggleLike();
  const toggleSave = useToggleSave();
  const addComment = useAddComment(id);
  const editComment = useEditComment(id);
  const deleteComment = useDeleteComment(id);

  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<Comment | null>(null);
  const [commentError, setCommentError] = useState<string>();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Comment | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.allSettled([
      queryClient.invalidateQueries({ queryKey: postKeys.detail(id) }),
      queryClient.invalidateQueries({ queryKey: commentKeys.list(id) }),
    ]);
    setRefreshing(false);
  };

  if (post.isPending) {
    return (
      <Screen header={<ScreenHeader back />} edges={["top", "bottom"]}>
        <View style={styles.loading} accessibilityLabel="Loading post">
          <Skeleton height={28} width="80%" />
          <Skeleton height={16} width="40%" />
          <Skeleton height={120} radius={Radius.md} />
        </View>
      </Screen>
    );
  }

  if (post.isError || !post.data) {
    return (
      <Screen header={<ScreenHeader back />} edges={["top", "bottom"]}>
        <EmptyState
          emoji="🔒"
          title="This post isn't available"
          subtitle={post.isError ? post.error.message : "It may have been deleted, or it's from a private account you don't follow."}
          action={<Button label="Back to feed" variant="secondary" size="md" onPress={() => router.navigate("/")} />}
        />
      </Screen>
    );
  }

  const p = post.data;
  const isMine = p.author_id === user?.id;

  const openAuthor = (authorId: string) => {
    if (authorId === user?.id) router.navigate("/profile");
    else router.push({ pathname: "/user/[id]", params: { id: authorId } });
  };

  const submitComment = () => {
    const body = draft.trim();
    if (!body) return;
    setCommentError(undefined);
    const options = {
      onSuccess: () => {
        setDraft("");
        setEditing(null);
      },
      onError: (e: unknown) => setCommentError(toPostError(e).message),
    };
    if (editing) editComment.mutate({ commentId: editing.id, body }, options);
    else addComment.mutate(body, options);
  };

  const busy = addComment.isPending || editComment.isPending;

  return (
    <Screen
      scroll
      edges={["top", "bottom"]}
      padded={false}
      contentStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.cyan} colors={[Colors.cyanDim]} />}
      header={
        <ScreenHeader
          back
          right={isMine ? <IconButton icon={<DotsIcon size={18} color={Colors.text1} />} onPress={() => setMenuOpen(true)} accessibilityLabel="Post options" /> : undefined}
        />
      }
    >
      {p.media_url ? <Image source={{ uri: p.media_url }} style={styles.image} contentFit="cover" accessibilityIgnoresInvertColors /> : null}

      <View style={styles.inner}>
        <View style={styles.badges}>
          <TypeBadge type={p.type} />
          <CategoryTag category={p.category} />
        </View>

        <AppText style={styles.title} accessibilityRole="header">
          {p.title}
        </AppText>

        <Pressable onPress={() => openAuthor(p.author_id)} accessibilityRole="button" accessibilityLabel={`Open ${p.author_display_name}'s profile`} style={styles.authorRow}>
          <Avatar name={p.author_display_name} uri={avatarPublicUrl(p.author_avatar_path)} size={40} />
          <View style={styles.flex}>
            <AppText variant="bodyBold">{p.author_display_name}</AppText>
            <AppText variant="caption" color={Colors.text2}>
              @{p.author_username} · {relativeTime(p.created_at)}
              {isEdited(p.created_at, p.updated_at) ? " · Edited" : ""}
            </AppText>
          </View>
        </Pressable>

        {p.event_at || p.location ? (
          <View style={styles.metaBox}>
            {p.event_at ? (
              <View style={styles.metaItem}>
                <CalendarIcon size={16} color={Colors.cyan} />
                <View>
                  <AppText variant="caption" color={Colors.text2}>
                    Date
                  </AppText>
                  <AppText variant="bodySemiBold">{formatEventDate(p.event_at)}</AppText>
                </View>
              </View>
            ) : null}
            {p.location ? (
              <View style={styles.metaItem}>
                <MapPinIcon size={16} color={Colors.gold} />
                <View>
                  <AppText variant="caption" color={Colors.text2}>
                    Location
                  </AppText>
                  <AppText variant="bodySemiBold">{p.location}</AppText>
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        <PostBodyText text={p.body} selectable />

        <View style={styles.actions}>
          <View style={styles.actionGroup}>
            <Pressable
              onPress={() => void toggleLike(p)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={p.liked_by_me ? "Unlike" : "Like"}
              accessibilityState={{ selected: p.liked_by_me }}
              style={styles.action}
            >
              {p.liked_by_me ? <HeartFilledIcon size={22} color={Colors.red} /> : <HeartIcon size={22} color={Colors.text2} />}
              <AppText variant="bodyMedium" color={p.liked_by_me ? Colors.red : Colors.text2}>
                {formatCount(p.like_count)}
              </AppText>
            </Pressable>
            <View style={styles.action} accessible accessibilityLabel={`${p.comment_count} comments`}>
              <ChatBubbleIcon size={22} color={Colors.text2} />
              <AppText variant="bodyMedium" color={Colors.text2}>
                {formatCount(p.comment_count)}
              </AppText>
            </View>
            <Pressable
              onPress={async () => {
                if (!(await sharePost(p))) toast.show("Sharing isn't available on this device.", "info");
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Share"
              style={styles.action}
            >
              <ShareIcon size={22} color={Colors.text2} />
            </Pressable>
          </View>
          <Pressable
            onPress={() => void toggleSave(p)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={p.saved_by_me ? "Remove from saved" : "Save"}
            accessibilityState={{ selected: p.saved_by_me }}
          >
            {p.saved_by_me ? <BookmarkFilledIcon size={22} color={Colors.cyan} /> : <BookmarkIcon size={22} color={Colors.text2} />}
          </Pressable>
        </View>

        {/* Comments */}
        <AppText variant="subheading" style={styles.commentsTitle}>
          Comments ({p.comment_count})
        </AppText>

        <View style={styles.composer}>
          <Avatar name={me.data?.display_name ?? "You"} uri={avatarPublicUrl(me.data?.avatar_path)} size={36} />
          <View style={styles.flex}>
            {editing ? (
              <View style={styles.editingBar}>
                <AppText variant="caption" color={Colors.gold}>
                  Editing your comment
                </AppText>
                <Pressable
                  onPress={() => {
                    setEditing(null);
                    setDraft("");
                  }}
                  accessibilityRole="button"
                >
                  <AppText variant="captionSemiBold" color={Colors.text2}>
                    Cancel
                  </AppText>
                </Pressable>
              </View>
            ) : null}
            <TextField
              placeholder="Add a comment…"
              value={draft}
              onChangeText={(t) => {
                setDraft(t);
                setCommentError(undefined);
              }}
              maxLength={COMMENT_MAX}
              multiline
              error={commentError}
              autoCapitalize="sentences"
              autoCorrect
              accessibilityLabel={editing ? "Edit comment" : "Add a comment"}
            />
          </View>
        </View>
        <Button
          label={editing ? "Save comment" : "Post comment"}
          onPress={submitComment}
          disabled={!draft.trim() || busy}
          loading={busy}
          variant="action"
          size="sm"
          style={styles.postButton}
        />

        {comments.isPending ? (
          <ActivityIndicator color={Colors.cyan} style={styles.commentsLoading} />
        ) : comments.isError ? (
          <View style={styles.gapSm}>
            <AppText variant="body" color={Colors.red}>
              Couldn&apos;t load comments. {comments.error.message}
            </AppText>
            <Button label="Try again" variant="secondary" size="sm" onPress={() => void comments.refetch()} />
          </View>
        ) : comments.data.length === 0 ? (
          <AppText variant="body" color={Colors.text2} align="center" style={styles.noComments}>
            Be the first to comment!
          </AppText>
        ) : (
          <View style={styles.commentList}>
            {comments.data.map((c) => {
              const own = c.author_id === user?.id;
              const name = c.author?.display_name ?? "Unknown";
              return (
                <View key={c.id} style={styles.comment}>
                  <Avatar name={name} uri={avatarPublicUrl(c.author?.avatar_path)} size={32} onPress={() => openAuthor(c.author_id)} />
                  <View style={styles.flex}>
                    <View style={styles.commentHead}>
                      <AppText variant="bodySemiBold" numberOfLines={1} style={styles.commentName}>
                        {name}
                      </AppText>
                      <AppText variant="caption" color={Colors.text3}>
                        {relativeTime(c.created_at)}
                        {isEdited(c.created_at, c.updated_at) ? " · Edited" : ""}
                      </AppText>
                    </View>
                    <AppText variant="body" color={Colors.text2} selectable>
                      {c.body}
                    </AppText>
                    {own ? (
                      <View style={styles.commentActions}>
                        <Pressable
                          onPress={() => {
                            setEditing(c);
                            setDraft(c.body);
                          }}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel="Edit comment"
                        >
                          <AppText variant="captionSemiBold" color={Colors.text2}>
                            Edit
                          </AppText>
                        </Pressable>
                        <Pressable onPress={() => setConfirmDelete(c)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Delete comment">
                          <AppText variant="captionSemiBold" color={Colors.red}>
                            Delete
                          </AppText>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {isMine ? <PostOwnerMenu post={p} visible={menuOpen} onClose={() => setMenuOpen(false)} onDeleted={() => router.back()} /> : null}

      <BottomSheet
        visible={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        dismissible={!deleteComment.isPending}
        title="Delete comment?"
        message="This can't be undone."
      >
        <Button
          label="Delete"
          variant="danger"
          fullWidth
          loading={deleteComment.isPending}
          onPress={() =>
            confirmDelete &&
            deleteComment.mutate(confirmDelete.id, {
              onSuccess: () => {
                if (editing?.id === confirmDelete.id) {
                  setEditing(null);
                  setDraft("");
                }
                setConfirmDelete(null);
              },
              onError: (e) => {
                setConfirmDelete(null);
                toast.show(toPostError(e).message, "error");
              },
            })
          }
        />
        <Button label="Cancel" variant="secondary" fullWidth disabled={deleteComment.isPending} onPress={() => setConfirmDelete(null)} />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: Spacing.xxxl * 2 },
  loading: { gap: Spacing.lg, paddingTop: Spacing.lg },
  image: { width: "100%", aspectRatio: 16 / 9, backgroundColor: Colors.elevated },
  inner: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, gap: Spacing.lg },
  badges: { flexDirection: "row", gap: 6 },
  title: { fontFamily: FontFamily.displayBlack, fontSize: 24, lineHeight: 30, color: Colors.text1 },
  authorRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  flex: { flex: 1, minWidth: 0 },
  metaBox: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xl,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.hairline,
  },
  metaItem: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.lg,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.hairline,
  },
  actionGroup: { flexDirection: "row", gap: Spacing.xl },
  action: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  commentsTitle: { marginTop: Spacing.sm },
  composer: { flexDirection: "row", gap: Spacing.md, alignItems: "flex-start" },
  editingBar: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  postButton: { alignSelf: "flex-end", marginTop: -Spacing.sm },
  commentsLoading: { marginTop: Spacing.lg },
  gapSm: { gap: Spacing.sm },
  noComments: { paddingVertical: Spacing.xxl },
  commentList: { gap: Spacing.xl },
  comment: { flexDirection: "row", gap: Spacing.md },
  commentHead: { flexDirection: "row", alignItems: "baseline", gap: Spacing.sm, marginBottom: 2 },
  commentName: { flexShrink: 1 },
  commentActions: { flexDirection: "row", gap: Spacing.lg, marginTop: Spacing.sm },
});
