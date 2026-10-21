/**
 * Discovery shapes (supabase/migrations/20261021140100…140400). Every list is
 * already filtered by the database to what the viewer may see: private
 * accounts' posts (unless followed) and blocked people never arrive here.
 */
import type { Relationship, SuggestedPerson } from "@/types/social";

/** One row of public.search_profiles(). match_rank: 0 exact username, 1 username prefix, 2 name words. */
export type ProfileHit = {
  id: string;
  username: string;
  display_name: string;
  avatar_path: string | null;
  is_private: boolean;
  follower_count: number;
  relationship: Relationship;
  match_rank: number;
};
export type ProfileCursor = { rank: number; username: string };
export type ProfileHitPage = { people: ProfileHit[]; nextCursor: ProfileCursor | null };

/** A hashtag and how many of its posts the viewer may see. Tags are lowercase [a-z0-9_]. */
export type HashtagHit = { tag: string; post_count: number };
export type HashtagHitPage = { tags: HashtagHit[]; nextCursor: string | null };

/** public.get_trending_hashtags(): last 7 days, score = 3·posts + likes + 2·comments (decision D39). */
export type TrendingTag = HashtagHit & { like_count: number; comment_count: number; score: number };

/** public.get_people_suggestions(): shared tags, then network, then popularity (decision D40). */
export type PeopleSuggestion = SuggestedPerson & { shared_tag_count: number; rank_key: number };
export type PeopleCursor = { key: number; id: string };
export type PeoplePage = { people: PeopleSuggestion[]; nextCursor: PeopleCursor | null };

/** Which list of posts query_posts() returns. */
export type PostListMode = "latest" | "top_week";
