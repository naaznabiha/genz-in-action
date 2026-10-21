import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import PostComposer from "@/components/posts/post-composer";
import Button from "@/components/ui/button";
import EmptyState from "@/components/ui/empty-state";
import Screen from "@/components/ui/screen";
import ScreenHeader from "@/components/ui/screen-header";
import { useToast } from "@/components/ui/toast";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";
import { usePost, useUpdatePost } from "@/hooks/use-posts";
import { deletePostImage } from "@/services/posts";
import type { PostInput } from "@/types/post";

/** Edit your own post (spec FR-08). Saving marks it "Edited" (spec §11). */
export default function EditPostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const post = usePost(id);
  const updatePost = useUpdatePost();

  const onSubmit = useCallback(
    async (input: PostInput) => {
      const unusedPhoto = await updatePost.mutateAsync({ postId: id, input });
      if (unusedPhoto) void deletePostImage(unusedPhoto); // replaced or removed photo
      return id;
    },
    [id, updatePost],
  );
  const onDone = useCallback(() => {
    toast.show("Post updated", "success");
    router.back();
  }, [router, toast]);

  if (post.isPending) {
    return (
      <Screen header={<ScreenHeader title="Edit Post" back />} edges={["top", "bottom"]}>
        <View style={styles.center}>
          <ActivityIndicator color={Colors.cyan} />
        </View>
      </Screen>
    );
  }
  if (post.isError || !post.data || post.data.author_id !== user?.id) {
    return (
      <Screen header={<ScreenHeader title="Edit Post" back />} edges={["top", "bottom"]}>
        <EmptyState
          emoji="🔒"
          title="You can't edit this post"
          subtitle={post.isError ? post.error.message : "Only the author can edit a post, and it may have been deleted."}
          action={<Button label="Go back" variant="secondary" size="md" onPress={() => router.back()} />}
        />
      </Screen>
    );
  }

  return <PostComposer initial={post.data} onSubmit={onSubmit} onDone={onDone} submitLabel="Save changes" />;
}

const styles = StyleSheet.create({ center: { flex: 1, alignItems: "center", justifyContent: "center" } });
