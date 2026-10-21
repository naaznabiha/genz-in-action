import { useRouter } from "expo-router";
import { Text, type StyleProp, type TextProps, type TextStyle } from "react-native";

import AppText from "@/components/ui/app-text";
import { Colors, FontFamily, type TypographyVariant } from "@/constants/theme";
import { splitHashtags } from "@/lib/hashtags";

type HashtagTextProps = {
  text: string;
  numberOfLines?: number;
  color?: string;
  variant?: TypographyVariant;
  style?: StyleProp<TextStyle>;
  /** Extra style for the #tag parts (they always inherit the surrounding font and size). */
  hashtagStyle?: StyleProp<TextStyle>;
  /** Tapping a #tag opens its hashtag feed (FR-13). Off in previews. */
  linkHashtags?: boolean;
} & Pick<TextProps, "selectable" | "accessibilityRole">;

/**
 * Text with #hashtags highlighted and, by default, tappable. Uses the same
 * hashtag rule as the database (lib/hashtags.ts ↔ public.extract_hashtags), so
 * every highlighted tag has a feed.
 */
export function HashtagText({
  text,
  numberOfLines,
  color = Colors.text2,
  variant = "body",
  style,
  hashtagStyle,
  linkHashtags = true,
  selectable,
  accessibilityRole,
}: HashtagTextProps) {
  const router = useRouter();
  return (
    <AppText variant={variant} color={color} style={style} numberOfLines={numberOfLines} selectable={selectable} accessibilityRole={accessibilityRole}>
      {splitHashtags(text).map((seg, i) =>
        seg.hashtag ? (
          <Text
            key={i}
            style={[{ color: Colors.cyan }, hashtagStyle]}
            suppressHighlighting
            {...(linkHashtags
              ? {
                  accessibilityRole: "link" as const,
                  accessibilityHint: `Opens posts tagged ${seg.text}`,
                  onPress: (e: { stopPropagation?: () => void }) => {
                    e.stopPropagation?.(); // don't also open the post the text sits in
                    router.push({ pathname: "/hashtag/[tag]", params: { tag: seg.hashtag! } });
                  },
                }
              : null)}
          >
            {seg.text}
          </Text>
        ) : (
          seg.text
        ),
      )}
    </AppText>
  );
}

type PostBodyTextProps = { text: string; numberOfLines?: number; color?: string; linkHashtags?: boolean } & Pick<TextProps, "selectable">;

/** Post body: #hashtags highlighted and tappable (Discovery, Phase 4). */
export default function PostBodyText({ text, numberOfLines, color = Colors.text2, selectable, linkHashtags = true }: PostBodyTextProps) {
  return (
    <HashtagText
      text={text}
      numberOfLines={numberOfLines}
      color={color}
      selectable={selectable}
      linkHashtags={linkHashtags}
      hashtagStyle={{ fontFamily: FontFamily.semiBold }}
    />
  );
}
