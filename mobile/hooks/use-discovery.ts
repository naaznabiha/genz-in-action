import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

import { discoveryKeys } from "@/hooks/discovery-keys";
import { useAuth } from "@/hooks/use-auth";
import { infinitePosts, postKeys } from "@/hooks/use-posts";
import { socialKeys } from "@/hooks/use-social";
import { loadRecentSearches, saveRecentSearches, withRecent } from "@/lib/recent-searches";
import {
  fetchHashtag,
  fetchPeopleSuggestions,
  fetchTrendingTags,
  queryPosts,
  searchHashtags,
  searchProfiles,
} from "@/services/discovery";
import type { HashtagHitPage, PeoplePage, ProfileCursor, ProfileHitPage } from "@/types/discovery";

/** Search results stay fresh for a minute: retyping a recent query is instant. */
const SEARCH_STALE_MS = 60_000;

// ---------------------------------------------------------------- search
export function useSearchProfiles(query: string) {
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: socialKeys.search(query),
    queryFn: ({ pageParam }: { pageParam: ProfileCursor | null }) => searchProfiles(query, pageParam),
    initialPageParam: null as ProfileCursor | null,
    getNextPageParam: (last: ProfileHitPage) => last.nextCursor,
    enabled: Boolean(user) && query.length > 0,
    staleTime: SEARCH_STALE_MS,
  });
}

export function useSearchPosts(query: string) {
  const { user } = useAuth();
  return useInfiniteQuery({
    ...infinitePosts(postKeys.search(query), (cursor) => queryPosts({ query, cursor }), Boolean(user) && query.length > 0),
    staleTime: SEARCH_STALE_MS,
  });
}

export function useSearchHashtags(query: string) {
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: discoveryKeys.hashtagSearch(query),
    queryFn: ({ pageParam }: { pageParam: string | null }) => searchHashtags(query, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last: HashtagHitPage) => last.nextCursor,
    enabled: Boolean(user) && query.length > 0,
    staleTime: SEARCH_STALE_MS,
  });
}

// ---------------------------------------------------------------- hashtags / trending
/** Posts with one tag, newest first. `tag` must already be normalised. */
export function useHashtagPosts(tag: string) {
  const { user } = useAuth();
  return useInfiniteQuery(infinitePosts(postKeys.hashtag(tag), (cursor) => queryPosts({ hashtag: tag, cursor }), Boolean(user) && tag.length > 0));
}

export function useHashtag(tag: string) {
  const { user } = useAuth();
  return useQuery({ queryKey: discoveryKeys.hashtag(tag), queryFn: () => fetchHashtag(tag), enabled: Boolean(user) && tag.length > 0 });
}

export function useTrendingTags(limit = 10) {
  const { user } = useAuth();
  return useQuery({ queryKey: discoveryKeys.trending(limit), queryFn: () => fetchTrendingTags(limit), enabled: Boolean(user), staleTime: 60_000 });
}

/** "Top Actions This Week": likes + 2×comments over the last 7 days (decision D39). */
export function useTopPostsThisWeek() {
  const { user } = useAuth();
  return useInfiniteQuery(infinitePosts(postKeys.topWeek, (cursor) => queryPosts({ mode: "top_week", cursor }), Boolean(user)));
}

// ---------------------------------------------------------------- people
export function usePeopleSuggestions() {
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: socialKeys.people,
    queryFn: ({ pageParam }: { pageParam: PeoplePage["nextCursor"] }) => fetchPeopleSuggestions(pageParam),
    initialPageParam: null as PeoplePage["nextCursor"],
    getNextPageParam: (last: PeoplePage) => last.nextCursor,
    enabled: Boolean(user),
  });
}

// ---------------------------------------------------------------- recent searches (device only)
export function useRecentSearches() {
  const { user } = useAuth();
  const userId = user?.id;
  const [items, setItems] = useState<string[]>([]);
  const itemsRef = useRef(items);

  const update = useCallback(
    (next: string[]) => {
      itemsRef.current = next;
      setItems(next);
      if (userId) void saveRecentSearches(userId, next);
    },
    [userId],
  );

  useEffect(() => {
    let alive = true;
    itemsRef.current = [];
    setItems([]);
    if (userId) {
      void loadRecentSearches(userId).then((stored) => {
        if (!alive) return;
        // Searches made while storage was loading stay on top.
        const list = itemsRef.current.reduceRight((acc, term) => withRecent(acc, term), stored);
        itemsRef.current = list;
        setItems(list);
      });
    }
    return () => {
      alive = false;
    };
  }, [userId]);

  const add = useCallback((term: string) => update(withRecent(itemsRef.current, term)), [update]);
  const remove = useCallback((term: string) => update(itemsRef.current.filter((t) => t !== term)), [update]);
  const clear = useCallback(() => update([]), [update]);

  return { items, add, remove, clear };
}
