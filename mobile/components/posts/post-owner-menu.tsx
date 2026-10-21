import { useRouter } from "expo-router";
import { useState } from "react";

import BottomSheet from "@/components/ui/bottom-sheet";
import Button from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useDeletePost } from "@/hooks/use-posts";
import type { Post } from "@/types/post";

type PostOwnerMenuProps = {
  post: Post;
  visible: boolean;
  onClose: () => void;
  /** Called after a successful delete (e.g. leave the detail screen). */
  onDeleted?: () => void;
};

/** Three-dot menu on your own post: Edit or Delete (with confirmation). */
export default function PostOwnerMenu({ post, visible, onClose, onDeleted }: PostOwnerMenuProps) {
  const router = useRouter();
  const toast = useToast();
  const deletePost = useDeletePost();
  const [confirming, setConfirming] = useState(false);

  const close = () => {
    setConfirming(false);
    onClose();
  };

  const handleDelete = () => {
    deletePost.mutate(
      { postId: post.id, mediaPath: post.media_path },
      {
        onSuccess: () => {
          close();
          toast.show("Post deleted", "success");
          onDeleted?.();
        },
        onError: (e) => toast.show(e instanceof Error ? e.message : "Couldn't delete the post.", "error"),
      },
    );
  };

  if (confirming) {
    return (
      <BottomSheet
        visible={visible}
        onClose={close}
        dismissible={!deletePost.isPending}
        title="Delete this post?"
        message="Its likes, comments and saves are removed too. This can't be undone."
      >
        <Button label="Delete post" variant="danger" fullWidth loading={deletePost.isPending} onPress={handleDelete} />
        <Button label="Cancel" variant="secondary" fullWidth disabled={deletePost.isPending} onPress={close} />
      </BottomSheet>
    );
  }

  return (
    <BottomSheet visible={visible} onClose={close} title="Your post">
      <Button
        label="Edit post"
        variant="secondary"
        fullWidth
        onPress={() => {
          close();
          router.push({ pathname: "/post/edit/[id]", params: { id: post.id } });
        }}
      />
      <Button label="Delete post" variant="destructive" fullWidth onPress={() => setConfirming(true)} />
      <Button label="Cancel" variant="ghost" fullWidth onPress={close} />
    </BottomSheet>
  );
}
