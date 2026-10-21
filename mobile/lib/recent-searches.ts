import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Recent searches are kept on the device only (AsyncStorage; localStorage on
 * web) — never sent to the server. One list per account, so a second account
 * on the same phone does not see them. Newest first, at most 10, no repeats
 * (case-insensitive).
 */
const MAX_RECENT = 10;
const MAX_LENGTH = 100;

const keyFor = (userId: string) => `genz.recent-searches.v1.${userId}`;

export async function loadRecentSearches(userId: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string").slice(0, MAX_RECENT) : [];
  } catch {
    return []; // unreadable storage → simply no history
  }
}

export async function saveRecentSearches(userId: string, items: string[]): Promise<void> {
  try {
    if (items.length === 0) await AsyncStorage.removeItem(keyFor(userId));
    else await AsyncStorage.setItem(keyFor(userId), JSON.stringify(items));
  } catch {
    // Storage full / unavailable: history is a convenience, never block search.
  }
}

/** The list with `term` moved/added to the front (pure). */
export function withRecent(current: string[], term: string): string[] {
  const clean = term.trim().replace(/\s+/g, " ").slice(0, MAX_LENGTH);
  if (!clean) return current;
  return [clean, ...current.filter((t) => t.toLowerCase() !== clean.toLowerCase())].slice(0, MAX_RECENT);
}
