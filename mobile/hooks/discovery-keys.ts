/**
 * Cache keys for discovery data that is NOT a list of posts (post lists live
 * under postKeys so likes/saves update everywhere; people lists live under
 * socialKeys so follow/block refreshes them). Kept in its own module so the
 * post and social hooks can refresh trending/hashtag counts without import
 * cycles.
 */
export const discoveryKeys = {
  all: ["discovery"] as const,
  hashtagSearch: (query: string) => ["discovery", "hashtag-search", query] as const,
  hashtag: (tag: string) => ["discovery", "hashtag", tag] as const,
  trending: (limit: number) => ["discovery", "trending", limit] as const,
};
