import { toPostError } from "@/lib/post-errors";
import { requireSupabaseConfig, supabase } from "@/lib/supabase";
import { PAGE_SIZE, withMediaUrls } from "@/services/posts";
import type {
  HashtagHit,
  HashtagHitPage,
  PeoplePage,
  PeopleSuggestion,
  PostListMode,
  ProfileCursor,
  ProfileHit,
  ProfileHitPage,
  TrendingTag,
} from "@/types/discovery";
import type { PostCursor, PostPage, PostRow } from "@/types/post";

/**
 * Discovery (spec FR-12/13/14/25). Every call is one RPC that returns one
 * keyset page; visibility (private accounts, blocks) is enforced in the
 * database by the shared Phase 3 helpers, never here.
 */

/** Normalises what someone typed or tapped into a stored tag: no '#', lowercase. */
export function normaliseTag(tag: string): string {
  return tag.replace(/^#+/, "").trim().toLowerCase();
}

type QueryPostsArgs = {
  query?: string | null;
  hashtag?: string | null;
  category?: string | null;
  mode?: PostListMode;
  cursor?: PostCursor | null;
  limit?: number;
};

/** One page of posts for search, a hashtag feed, a category, or "Top posts this week". */
export async function queryPosts({ query, hashtag, category, mode = "latest", cursor, limit = PAGE_SIZE }: QueryPostsArgs): Promise<PostPage> {
  requireSupabaseConfig();
  const { data, error } = await supabase.rpc("query_posts", {
    p_query: query ?? null,
    p_hashtag: hashtag ?? null,
    p_category: category ?? null,
    p_mode: mode,
    p_before_score: cursor?.score ?? null,
    p_before_created: cursor?.createdAt ?? null,
    p_before_id: cursor?.id ?? null,
    p_limit: limit,
  });
  if (error) throw toPostError(error);
  const rows = (data ?? []) as (PostRow & { score: number })[];
  const posts = await withMediaUrls(rows);
  const last = rows[rows.length - 1];
  return {
    posts,
    nextCursor:
      rows.length === limit && last
        ? { createdAt: last.created_at, id: last.id, ...(mode === "top_week" ? { score: last.score } : {}) }
        : null,
  };
}

/** People search: exact @username first, then usernames starting with the text, then name words. */
export async function searchProfiles(query: string, cursor: ProfileCursor | null, limit = PAGE_SIZE): Promise<ProfileHitPage> {
  requireSupabaseConfig();
  const { data, error } = await supabase.rpc("search_profiles", {
    p_query: query,
    p_limit: limit,
    p_after_rank: cursor?.rank ?? null,
    p_after_name: cursor?.username ?? null,
  });
  if (error) throw toPostError(error);
  const people = (data ?? []) as ProfileHit[];
  const last = people[people.length - 1];
  return { people, nextCursor: people.length === limit && last ? { rank: last.match_rank, username: last.username } : null };
}

/** Hashtags starting with the text (a leading # is ignored), alphabetical, with visible post counts. */
export async function searchHashtags(query: string, afterTag: string | null, limit = PAGE_SIZE): Promise<HashtagHitPage> {
  requireSupabaseConfig();
  const { data, error } = await supabase.rpc("search_hashtags", { p_query: query, p_limit: limit, p_after_tag: afterTag });
  if (error) throw toPostError(error);
  const tags = (data ?? []) as HashtagHit[];
  const last = tags[tags.length - 1];
  return { tags, nextCursor: tags.length === limit && last ? last.tag : null };
}

/** Hashtag feed header; null when the viewer can see no post with this tag. */
export async function fetchHashtag(tag: string): Promise<HashtagHit | null> {
  requireSupabaseConfig();
  const { data, error } = await supabase.rpc("get_hashtag", { p_tag: tag });
  if (error) throw toPostError(error);
  return ((data ?? []) as HashtagHit[])[0] ?? null;
}

/** Trending tags (last 7 days, decision D39), highest score first. */
export async function fetchTrendingTags(limit = 10): Promise<TrendingTag[]> {
  requireSupabaseConfig();
  const { data, error } = await supabase.rpc("get_trending_hashtags", { p_limit: limit });
  if (error) throw toPostError(error);
  return (data ?? []) as TrendingTag[];
}

/** Explore → People: everyone you might follow, best match first (decision D40), paginated. */
export async function fetchPeopleSuggestions(cursor: PeoplePage["nextCursor"], limit = PAGE_SIZE): Promise<PeoplePage> {
  requireSupabaseConfig();
  const { data, error } = await supabase.rpc("get_people_suggestions", {
    p_limit: limit,
    p_after_key: cursor?.key ?? null,
    p_after_id: cursor?.id ?? null,
  });
  if (error) throw toPostError(error);
  const people = (data ?? []) as PeopleSuggestion[];
  const last = people[people.length - 1];
  return { people, nextCursor: people.length === limit && last ? { key: last.rank_key, id: last.id } : null };
}
