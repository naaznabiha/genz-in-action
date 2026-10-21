import * as Linking from "expo-linking";
import { Share } from "react-native";

/**
 * Link that opens a post in the app (decision D26). In a store/dev build this is
 * genzinaction://post/<id>; in Expo Go it is the exp:// URL of the running dev
 * server. Without the app, the recipient only sees the message text (no web
 * fallback until a domain/store listing exists).
 */
export function postLink(postId: string): string {
  return Linking.createURL(`/post/${postId}`);
}

/** Opens the phone's share sheet. Returns false when sharing is not available (e.g. some web browsers). */
export async function sharePost(post: { id: string; title: string; body: string }): Promise<boolean> {
  const excerpt = post.body.length > 140 ? `${post.body.slice(0, 137).trimEnd()}…` : post.body;
  const url = postLink(post.id);
  try {
    await Share.share({ message: `${post.title}\n\n${excerpt}\n\nOpen in GenZ in Action: ${url}`, url, title: post.title });
    return true;
  } catch {
    return false;
  }
}
