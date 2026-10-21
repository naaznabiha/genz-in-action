import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData, type QueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { useToast } from "@/components/ui/toast";
import { discoveryKeys } from "@/hooks/discovery-keys";
import { useAuth } from "@/hooks/use-auth";
import { impactKeys } from "@/hooks/use-impact";
import {
  addComment,
  createPost,
  deleteComment,
  deletePost,
  editComment,
  fetchComments,
  fetchFeaturedPost,
  fetchPost,
  fetchPosts,
  likePost,
  savePost,
  unlikePost,
  unsavePost,
  updatePost,
} from "@/services/posts";
import type { Post, PostCursor, PostInput, PostPage } from "@/types/post";

export const postKeys = {
  all: ["posts"] as const,
  feed: (category: string | null) => ["posts", "feed", category ?? "all"] as const,
  user: (userId: string) => ["posts", "user", userId] as const,
  detail: (postId: string) => ["posts", "detail", postId] as const,
  featured: ["posts", "featured"] as const,
  // Discovery post lists (Phase 4) — under "posts" so likes/saves/deletes reach them too.
  search: (query: string) => ["posts", "search", query] as const,
  hashtag: (tag: string) => ["posts", "hashtag", tag] as const,
  topWeek: ["posts", "top-week"] as const,
};
export const commentKeys = { list: (postId: string) => ["comments", postId] as const };

type PostCache = InfiniteData<PostPage, PostCursor | null> | Post | null | undefined;

/** Applies `update` to every cached copy of a post (feeds, profile lists, detail, featured). */
export function patchPostEverywhere(queryClient: QueryClient, postId: string, update: (post: Post) => Post) {
  for (const [key, data] of queryClient.getQueriesData<PostCache>({ queryKey: postKeys.all })) {
    if (!data) continue;
    if (typeof data === "object" && "pages" in data) {
      queryClient.setQueryData<InfiniteData<PostPage, PostCursor | null>>(key, {
        ...data,
        pages: data.pages.map((page) => ({ ...page, posts: page.posts.map((p) => (p.id === postId ? update(p) : p)) })),
      });
    } else if ((data as Post).id === postId) {
      queryClient.setQueryData<Post>(key, update(data as Post));
    }
  }
}

/** Removes a deleted post from every cached list. */
function removePostEverywhere(queryClient: QueryClient, postId: string) {
  for (const [key, data] of queryClient.getQueriesData<PostCache>({ queryKey: postKeys.all })) {
    if (data && typeof data === "object" && "pages" in data) {
      queryClient.setQueryData<InfiniteData<PostPage, PostCursor | null>>(key, {
        ...data,
        pages: data.pages.map((page) => ({ ...page, posts: page.posts.filter((p) => p.id !== postId) })),
      });
    }
  }
}

export function infinitePosts(key: readonly unknown[], fetchPage: (cursor: PostCursor | null) => Promise<PostPage>, enabled: boolean) {
  return {
    queryKey: key,
    queryFn: ({ pageParam }: { pageParam: PostCursor | null }) => fetchPage(pageParam),
    initialPageParam: null as PostCursor | null,
    getNextPageParam: (last: PostPage) => last.nextCursor,
    enabled,
  };
}

/** Home feed: everything the viewer may see, newest first, 20 per page, optional category. */
export function useFeed(category: string | null) {
  const { user } = useAuth();
  return useInfiniteQuery(infinitePosts(postKeys.feed(category), (cursor) => fetchPosts({ category, cursor }), Boolean(user)));
}

/** One author's posts (profile "Actions" tab). Disable when the viewer may not see them. */
export function useUserPosts(userId: string | undefined, enabled = true) {
  return useInfiniteQuery(
    infinitePosts(postKeys.user(userId ?? "none"), (cursor) => fetchPosts({ authorId: userId, cursor }), Boolean(userId) && enabled),
  );
}

export function usePost(postId: string | undefined) {
  return useQuery({
    queryKey: postKeys.detail(postId ?? "none"),
    queryFn: () => fetchPost(postId as string),
    enabled: Boolean(postId),
  });
}

export function useFeaturedPost() {
  const { user } = useAuth();
  return useQuery({ queryKey: postKeys.featured, queryFn: fetchFeaturedPost, enabled: Boolean(user) });
}

/** After a post changes, lists, trending/hashtag counts, impact and the author's counts must refresh. */
function invalidateAfterPostChange(queryClient: QueryClient, userId: string | undefined) {
  void queryClient.invalidateQueries({ queryKey: postKeys.all });
  void queryClient.invalidateQueries({ queryKey: discoveryKeys.all });
  if (userId) {
    void queryClient.invalidateQueries({ queryKey: impactKeys.mine(userId) });
    void queryClient.invalidateQueries({ queryKey: ["social", "summary", userId] });
  }
}

export function useCreatePost() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PostInput) => createPost(input),
    onSuccess: () => invalidateAfterPostChange(queryClient, user?.id),
  });
}

export function useUpdatePost() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, input }: { postId: string; input: PostInput }) => updatePost(postId, input),
    onSuccess: () => invalidateAfterPostChange(queryClient, user?.id),
  });
}

export function useDeletePost() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, mediaPath }: { postId: string; mediaPath: string | null }) => deletePost(postId, mediaPath),
    onSuccess: (_d, { postId }) => {
      removePostEverywhere(queryClient, postId);
      queryClient.removeQueries({ queryKey: postKeys.detail(postId) });
      queryClient.removeQueries({ queryKey: commentKeys.list(postId) });
      invalidateAfterPostChange(queryClient, user?.id);
    },
  });
}

// ---------------------------------------------------------------- like / save
// One request per post at a time: extra taps while a request is in flight are
// ignored, so the optimistic state can never drift from the server.
const pendingLikes = new Set<string>();
const pendingSaves = new Set<string>();

/**
 * Heart: flips instantly, then writes. If the write fails it flips back and a
 * message is shown, so a failed like never looks successful.
 */
export function useToggleLike() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();

  return useCallback(
    async (post: Post) => {
      if (!user || pendingLikes.has(post.id)) return;
      pendingLikes.add(post.id);
      const like = !post.liked_by_me;
      const apply = (liked: boolean) =>
        patchPostEverywhere(queryClient, post.id, (p) =>
          p.liked_by_me === liked ? p : { ...p, liked_by_me: liked, like_count: Math.max(0, p.like_count + (liked ? 1 : -1)) },
        );
      apply(like);
      try {
        if (like) await likePost(post.id, user.id);
        else await unlikePost(post.id, user.id);
        void queryClient.invalidateQueries({ queryKey: impactKeys.mine(user.id) });
      } catch (error) {
        apply(!like);
        toast.show(error instanceof Error ? error.message : "Couldn't update your like.", "error");
      } finally {
        pendingLikes.delete(post.id);
      }
    },
    [queryClient, toast, user],
  );
}

/** Bookmark: same optimistic + rollback behaviour as likes. */
export function useToggleSave() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();

  return useCallback(
    async (post: Post) => {
      if (!user || pendingSaves.has(post.id)) return;
      pendingSaves.add(post.id);
      const save = !post.saved_by_me;
      const apply = (saved: boolean) => patchPostEverywhere(queryClient, post.id, (p) => ({ ...p, saved_by_me: saved }));
      apply(save);
      try {
        if (save) await savePost(post.id, user.id);
        else await unsavePost(post.id, user.id);
        toast.show(save ? "Saved" : "Removed from saved", "success");
      } catch (error) {
        apply(!save);
        toast.show(error instanceof Error ? error.message : "Couldn't update saved posts.", "error");
      } finally {
        pendingSaves.delete(post.id);
      }
    },
    [queryClient, toast, user],
  );
}

// ---------------------------------------------------------------- comments
export function useComments(postId: string | undefined) {
  return useQuery({
    queryKey: commentKeys.list(postId ?? "none"),
    queryFn: () => fetchComments(postId as string),
    enabled: Boolean(postId),
  });
}

export function useAddComment(postId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => addComment(postId, user!.id, body),
    onSuccess: () => {
      patchPostEverywhere(queryClient, postId, (p) => ({ ...p, comment_count: p.comment_count + 1 }));
      void queryClient.invalidateQueries({ queryKey: commentKeys.list(postId) });
      void queryClient.invalidateQueries({ queryKey: postKeys.detail(postId) });
      if (user) void queryClient.invalidateQueries({ queryKey: impactKeys.mine(user.id) });
    },
  });
}

export function useEditComment(postId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, body }: { commentId: string; body: string }) => editComment(commentId, body),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: commentKeys.list(postId) }),
  });
}

export function useDeleteComment(postId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => deleteComment(commentId),
    onSuccess: () => {
      patchPostEverywhere(queryClient, postId, (p) => ({ ...p, comment_count: Math.max(0, p.comment_count - 1) }));
      void queryClient.invalidateQueries({ queryKey: commentKeys.list(postId) });
      void queryClient.invalidateQueries({ queryKey: postKeys.detail(postId) });
    },
  });
}
