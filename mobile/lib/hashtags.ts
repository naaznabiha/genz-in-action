/**
 * Hashtag detection — mirrors public.extract_hashtags() in
 * supabase/migrations/20261021120400_hashtags.sql. The database is the source of
 * truth (it stores the tags); the app uses this only to preview and highlight.
 * Rule: '#' at the start or after a non-word character, then 2–50 of [A-Za-z0-9_]
 * with at least one letter; lowercase; max 20 distinct.
 */
const HASHTAG_RE = /(^|[^A-Za-z0-9_&/])#([A-Za-z0-9_]{2,50})/g;

export function extractHashtags(text: string): string[] {
  const seen = new Set<string>();
  for (const match of text.matchAll(HASHTAG_RE)) {
    const tag = match[2].toLowerCase();
    if (/[a-z]/.test(tag)) seen.add(tag);
    if (seen.size >= 20) break;
  }
  return [...seen];
}

export type TextSegment = { text: string; hashtag?: string };

/** Splits text into plain and hashtag segments for highlighting. */
export function splitHashtags(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(HASHTAG_RE)) {
    const tag = match[2];
    if (!/[a-z]/i.test(tag)) continue;
    const start = (match.index ?? 0) + match[1].length;
    if (start > last) segments.push({ text: text.slice(last, start) });
    segments.push({ text: `#${tag}`, hashtag: tag.toLowerCase() });
    last = start + tag.length + 1;
  }
  if (last < text.length) segments.push({ text: text.slice(last) });
  return segments;
}
