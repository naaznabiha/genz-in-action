import { useRouter } from "expo-router";
import { useCallback } from "react";

import PostComposer from "@/components/posts/post-composer";
import { useToast } from "@/components/ui/toast";
import { useCreatePost } from "@/hooks/use-posts";
import type { PostInput } from "@/types/post";

/** Create tab (spec FR-08; prototype CreateScreen). Publishes, then opens the new post. */
export default function CreateScreen() {
  const router = useRouter();
  const toast = useToast();
  const createPost = useCreatePost();

  const onSubmit = useCallback((input: PostInput) => createPost.mutateAsync(input), [createPost]);
  const onDone = useCallback(
    (postId: string) => {
      toast.show("Post published", "success");
      router.push({ pathname: "/post/[id]", params: { id: postId } });
    },
    [router, toast],
  );

  return <PostComposer onSubmit={onSubmit} onDone={onDone} submitLabel="Publish ⚡" />;
}
