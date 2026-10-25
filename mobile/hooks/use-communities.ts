import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData, type QueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { useAuth } from "@/hooks/use-auth";
import { notificationKeys } from "@/hooks/use-notifications";
import { postKeys } from "@/hooks/use-posts";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import {
  addContent,
  cancelInvite,
  createCommunity,
  deleteCommunity,
  deleteContent,
  deleteMessage,
  fetchCommunities,
  fetchCommunity,
  fetchCommunityInvites,
  fetchContentItem,
  fetchFeed,
  fetchMembers,
  fetchMessages,
  fetchMyInvites,
  fetchPinned,
  fetchStarred,
  inviteToCommunity,
  joinCommunity,
  leaveCommunity,
  removeMember,
  respondToInvite,
  sendMessage,
  setMemberRole,
  setPin,
  setStar,
  transferOwnership,
  updateCommunity,
  type CommunityInput,
  type ContentInput,
  type FeedCursor,
  type FeedPage,
} from "@/services/communities";
import type {
  CommunityCursor,
  CommunityMessage,
  CommunityPage,
  FeedFilter,
  MemberCursor,
  MemberPage,
  MessageCursor,
  MessagePage,
  PickedAttachment,
  StarredPage,
} from "@/types/community";

export const communityKeys = {
  all: ["communities"] as const,
  list: (scope: "discover" | "mine", query: string) => ["communities", "list", scope, query] as const,
  myInvites: ["communities", "my-invites"] as const,
  detail: (id: string) => ["communities", "detail", id] as const,
  members: (id: string) => ["communities", "members", id] as const,
  invites: (id: string) => ["communities", "invites", id] as const,
  messages: (id: string) => ["communities", "messages", id] as const,
  pinned: (id: string) => ["communities", "pinned", id] as const,
  starred: (id: string) => ["communities", "starred", id] as const,
  feed: (id: string, filter: FeedFilter) => ["communities", "feed", id, filter] as const,
  feedAll: (id: string) => ["communities", "feed", id] as const,
  content: (contentId: string) => ["communities", "content", contentId] as const,
};

type MessagesCache = InfiniteData<MessagePage, MessageCursor | null>;

/** Membership changed: every community list, the detail, notifications and post lists (Home shows member posts). */
function refreshAfterMembership(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: communityKeys.all });
  void qc.invalidateQueries({ queryKey: notificationKeys.all });
  void qc.invalidateQueries({ queryKey: postKeys.all });
}

// ---------------------------------------------------------------- reads
export function useCommunities(scope: "discover" | "mine", query = "") {
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: communityKeys.list(scope, query),
    queryFn: ({ pageParam }: { pageParam: CommunityCursor | null }) => fetchCommunities(scope, query || null, pageParam),
    initialPageParam: null as CommunityCursor | null,
    getNextPageParam: (last: CommunityPage) => last.nextCursor,
    enabled: Boolean(user),
  });
}

export function useMyCommunityInvites() {
  const { user } = useAuth();
  return useQuery({ queryKey: communityKeys.myInvites, queryFn: fetchMyInvites, enabled: Boolean(user) });
}

export function useCommunity(id: string | undefined) {
  const { user } = useAuth();
  return useQuery({ queryKey: communityKeys.detail(id ?? "none"), queryFn: () => fetchCommunity(id as string), enabled: Boolean(user && id) });
}

export function useCommunityMembers(id: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: communityKeys.members(id),
    queryFn: ({ pageParam }: { pageParam: MemberCursor | null }) => fetchMembers(id, pageParam),
    initialPageParam: null as MemberCursor | null,
    getNextPageParam: (last: MemberPage) => last.nextCursor,
    enabled,
  });
}

export function usePendingInvites(id: string, enabled: boolean) {
  return useQuery({ queryKey: communityKeys.invites(id), queryFn: () => fetchCommunityInvites(id), enabled });
}

/** Discussion, newest first (the list is drawn inverted), 50 per page. */
export function useMessages(id: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: communityKeys.messages(id),
    queryFn: ({ pageParam }: { pageParam: MessageCursor | null }) => fetchMessages(id, pageParam),
    initialPageParam: null as MessageCursor | null,
    getNextPageParam: (last: MessagePage) => last.nextCursor,
    enabled,
  });
}

export function usePinned(id: string, enabled: boolean) {
  return useQuery({ queryKey: communityKeys.pinned(id), queryFn: () => fetchPinned(id), enabled });
}

export function useStarred(id: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: communityKeys.starred(id),
    queryFn: ({ pageParam }: { pageParam: MessageCursor | null }) => fetchStarred(id, pageParam),
    initialPageParam: null as MessageCursor | null,
    getNextPageParam: (last: StarredPage) => last.nextCursor,
    enabled,
  });
}

export function useCommunityFeed(id: string, filter: FeedFilter, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: communityKeys.feed(id, filter),
    queryFn: ({ pageParam }: { pageParam: FeedCursor | null }) => fetchFeed(id, filter, pageParam),
    initialPageParam: null as FeedCursor | null,
    getNextPageParam: (last: FeedPage) => last.nextCursor,
    enabled,
  });
}

export function useContentItem(contentId: string | undefined) {
  return useQuery({ queryKey: communityKeys.content(contentId ?? "none"), queryFn: () => fetchContentItem(contentId as string), enabled: Boolean(contentId) });
}

/**
 * Live discussion (Supabase Realtime) while a community screen is open:
 * new / deleted messages and pin changes refresh the discussion and the pinned
 * banner on every member's phone. Realtime applies the same RLS as reads, so
 * only people who can read the community receive its messages. Deletes can't
 * be filtered by community, so they refresh only when the deleted id is one
 * we have loaded. Without Realtime the screen still refreshes on pull and focus.
 */
export function useCommunitySync(id: string, enabled: boolean) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!enabled || !isSupabaseConfigured) return;
    const hasMessage = (messageId: unknown) =>
      Boolean(qc.getQueryData<MessagesCache>(communityKeys.messages(id))?.pages.some((p) => p.messages.some((m) => m.id === messageId)));
    const refreshMessages = () => {
      void qc.invalidateQueries({ queryKey: communityKeys.messages(id) });
      void qc.invalidateQueries({ queryKey: communityKeys.detail(id) });
    };
    const refreshPins = () => {
      void qc.invalidateQueries({ queryKey: communityKeys.pinned(id) });
      void qc.invalidateQueries({ queryKey: communityKeys.messages(id) });
      void qc.invalidateQueries({ queryKey: communityKeys.detail(id) });
    };
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel(`community:${id}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "community_messages", filter: `community_id=eq.${id}` }, refreshMessages)
        .on("postgres_changes", { event: "DELETE", schema: "public", table: "community_messages" }, (payload) => {
          if (hasMessage((payload.old as { id?: string }).id)) refreshMessages();
        })
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "community_message_pins", filter: `community_id=eq.${id}` }, refreshPins)
        .on("postgres_changes", { event: "DELETE", schema: "public", table: "community_message_pins" }, (payload) => {
          if (hasMessage((payload.old as { message_id?: string }).message_id)) refreshPins();
        })
        .subscribe();
    } catch {
      channel = null;
    }
    return () => {
      if (channel) void supabase.removeChannel(channel);
    };
  }, [id, enabled, qc]);
}

// ---------------------------------------------------------------- community + membership
export function useCreateCommunity() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (input: CommunityInput) => createCommunity(input), onSuccess: () => refreshAfterMembership(qc) });
}

export function useUpdateCommunity(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<CommunityInput, "isPrivate">) => updateCommunity(id, input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: communityKeys.all }),
  });
}

/** Membership actions: all refresh the same data afterwards. */
export function useMembershipAction<T, R = unknown>(fn: (arg: T) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSettled: () => refreshAfterMembership(qc) });
}

export const useJoinCommunity = () => useMembershipAction((id: string) => joinCommunity(id));
export const useLeaveCommunity = () => useMembershipAction((id: string) => leaveCommunity(id));
export const useDeleteCommunity = () => useMembershipAction((id: string) => deleteCommunity(id));
export const useRespondToInvite = () => useMembershipAction(({ inviteId, accept }: { inviteId: string; accept: boolean }) => respondToInvite(inviteId, accept));
export const useInvite = (id: string) => useMembershipAction((userId: string) => inviteToCommunity(id, userId));
export const useCancelInvite = () => useMembershipAction((inviteId: string) => cancelInvite(inviteId));
export const useSetMemberRole = (id: string) => useMembershipAction(({ userId, role }: { userId: string; role: "admin" | "member" }) => setMemberRole(id, userId, role));
export const useRemoveMember = (id: string) => useMembershipAction((userId: string) => removeMember(id, userId));
export const useTransferOwnership = (id: string) => useMembershipAction((userId: string) => transferOwnership(id, userId));

// ---------------------------------------------------------------- discussion
function patchMessages(qc: QueryClient, id: string, update: (m: CommunityMessage) => CommunityMessage | null) {
  qc.setQueryData<MessagesCache>(communityKeys.messages(id), (data) =>
    data
      ? {
          ...data,
          pages: data.pages.map((p) => ({ ...p, messages: p.messages.map(update).filter((m): m is CommunityMessage => m !== null) })),
        }
      : data,
  );
}

export function useSendMessage(id: string) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ body, file }: { body: string; file: PickedAttachment | null }) => sendMessage(id, user!.id, body, file),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: communityKeys.messages(id) });
      void qc.invalidateQueries({ queryKey: communityKeys.detail(id) });
    },
  });
}

export function useDeleteMessage(id: string) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (m: CommunityMessage) => deleteMessage(m.id, m.author_id === user?.id ? m.attachment_path : null),
    onSuccess: (_d, m) => {
      patchMessages(qc, id, (x) => (x.id === m.id ? null : x));
      void qc.invalidateQueries({ queryKey: communityKeys.pinned(id) });
      void qc.invalidateQueries({ queryKey: communityKeys.starred(id) });
      void qc.invalidateQueries({ queryKey: communityKeys.detail(id) });
    },
  });
}

/** Star: private to you (D49). Flips at once; rolls back if the write fails. */
export function useToggleStar(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, starred }: { messageId: string; starred: boolean }) => setStar(messageId, starred),
    onMutate: ({ messageId, starred }) => patchMessages(qc, id, (m) => (m.id === messageId ? { ...m, starred_by_me: starred } : m)),
    onError: (_e, { messageId, starred }) => patchMessages(qc, id, (m) => (m.id === messageId ? { ...m, starred_by_me: !starred } : m)),
    onSettled: () => void qc.invalidateQueries({ queryKey: communityKeys.starred(id) }),
  });
}

/** Pin for everyone: owner and admins only (the database enforces it). */
export function useTogglePin(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, pinned }: { messageId: string; pinned: boolean }) => setPin(messageId, pinned),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: communityKeys.pinned(id) });
      void qc.invalidateQueries({ queryKey: communityKeys.messages(id) });
      void qc.invalidateQueries({ queryKey: communityKeys.detail(id) });
    },
  });
}

// ---------------------------------------------------------------- content
export function useAddContent(id: string) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ContentInput) => addContent(id, user!.id, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: communityKeys.feedAll(id) });
      void qc.invalidateQueries({ queryKey: communityKeys.detail(id) });
    },
  });
}

export function useDeleteContent(id: string) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (c: { id: string; author_id: string; attachment: { path: string } | null }) =>
      deleteContent(c.id, c.author_id === user?.id ? (c.attachment?.path ?? null) : null),
    onSuccess: (_d, c) => {
      qc.removeQueries({ queryKey: communityKeys.content(c.id) });
      void qc.invalidateQueries({ queryKey: communityKeys.feedAll(id) });
      void qc.invalidateQueries({ queryKey: communityKeys.detail(id) });
      void qc.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}
