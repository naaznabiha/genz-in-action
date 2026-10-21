import { useRouter } from "expo-router";
import { Fragment } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { FireIcon } from "@/components/icons";
import AppText from "@/components/ui/app-text";
import Card from "@/components/ui/card";
import { CategoryColors, Colors, FontFamily, Radius, Spacing } from "@/constants/theme";
import { formatCount } from "@/lib/time";
import type { HashtagHit } from "@/types/discovery";

export const postsLabel = (n: number) => `${formatCount(n)} ${n === 1 ? "post" : "posts"}`;

function useOpenTag(onOpen?: (tag: string) => void) {
  const router = useRouter();
  return (tag: string) => {
    onOpen?.(tag);
    router.push({ pathname: "/hashtag/[tag]", params: { tag } });
  };
}

const ACCENTS = [
  CategoryColors.climate.text,
  CategoryColors["mental-health"].text,
  Colors.cyan,
  CategoryColors.housing.text,
  CategoryColors.equality.text,
];

/** Home "📈 Trending Right Now" (prototype HomeScreen): one card, ranked rows with a colour bar. */
export function TrendingCompactList({ tags }: { tags: HashtagHit[] }) {
  const open = useOpenTag();
  return (
    <Card padded={false}>
      {tags.map((t, i) => (
        <Fragment key={t.tag}>
          {i > 0 ? <View style={styles.compactDivider} /> : null}
          <Pressable
            onPress={() => open(t.tag)}
            accessibilityRole="link"
            accessibilityLabel={`Trending number ${i + 1}: #${t.tag}, ${postsLabel(t.post_count)}`}
            style={({ pressed }) => [styles.compactRow, pressed && styles.pressed]}
          >
            <AppText style={styles.compactRank} color={Colors.text3}>
              #{i + 1}
            </AppText>
            <View style={styles.flex}>
              <AppText variant="bodyBold" numberOfLines={1}>
                #{t.tag}
              </AppText>
              <AppText style={styles.small} color={Colors.text3}>
                {postsLabel(t.post_count)}
              </AppText>
            </View>
            <View style={[styles.bar, { backgroundColor: ACCENTS[i % ACCENTS.length] }]} />
          </Pressable>
        </Fragment>
      ))}
    </Card>
  );
}

/** Explore → Trending (prototype ExploreScreen): rank, tag, count, fire (orange for the top 3). */
export function TrendingRankedList({ tags }: { tags: HashtagHit[] }) {
  const open = useOpenTag();
  return (
    <View style={styles.rankedList}>
      {tags.map((t, i) => (
        <Pressable
          key={t.tag}
          onPress={() => open(t.tag)}
          accessibilityRole="link"
          accessibilityLabel={`Trending number ${i + 1}: #${t.tag}, ${postsLabel(t.post_count)}`}
          style={({ pressed }) => [styles.rankedRow, pressed && styles.pressed]}
        >
          <AppText style={styles.rank} color={Colors.text3}>
            {i + 1}
          </AppText>
          <View style={styles.flex}>
            <AppText variant="bodyBold" numberOfLines={1}>
              #{t.tag}
            </AppText>
            <AppText variant="caption" color={Colors.text2}>
              {postsLabel(t.post_count)}
            </AppText>
          </View>
          <FireIcon size={16} color={i < 3 ? CategoryColors.housing.text : Colors.text3} />
        </Pressable>
      ))}
    </View>
  );
}

/** A hashtag search result. */
export function HashtagRow({ tag, onOpen }: { tag: HashtagHit; onOpen?: (tag: string) => void }) {
  const open = useOpenTag(onOpen);
  return (
    <Pressable
      onPress={() => open(tag.tag)}
      accessibilityRole="link"
      accessibilityLabel={`#${tag.tag}, ${postsLabel(tag.post_count)}`}
      style={({ pressed }) => [styles.tagRow, pressed && styles.pressed]}
    >
      <View style={styles.hashBadge}>
        <AppText style={styles.hash} color={Colors.cyan}>
          #
        </AppText>
      </View>
      <View style={styles.flex}>
        <AppText variant="bodySemiBold" numberOfLines={1}>
          #{tag.tag}
        </AppText>
        <AppText variant="caption" color={Colors.text2}>
          {postsLabel(tag.post_count)}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.8 },
  compactRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  compactDivider: { height: 1, backgroundColor: Colors.divider, marginLeft: 48 },
  compactRank: { width: 22, textAlign: "center", fontFamily: FontFamily.displayBlack, fontSize: 14, lineHeight: 18 },
  small: { fontSize: 11, lineHeight: 14 },
  bar: { width: 6, height: 32, borderRadius: Radius.full, opacity: 0.7 },
  rankedList: { gap: Spacing.sm },
  rankedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.hairline,
  },
  rank: { width: 24, textAlign: "center", fontFamily: FontFamily.displayBlack, fontSize: 16, lineHeight: 20 },
  tagRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md, paddingVertical: Spacing.md },
  hashBadge: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.cyanTint,
    alignItems: "center",
    justifyContent: "center",
  },
  hash: { fontFamily: FontFamily.displayBlack, fontSize: 20, lineHeight: 24 },
});
