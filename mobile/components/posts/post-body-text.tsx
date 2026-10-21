import type { TextProps } from "react-native";

import AppText from "@/components/ui/app-text";
import { Colors, FontFamily } from "@/constants/theme";
import { splitHashtags } from "@/lib/hashtags";

type PostBodyTextProps = { text: string; numberOfLines?: number; color?: string } & Pick<TextProps, "selectable">;

/**
 * Post text with #hashtags highlighted. Hashtag feeds arrive with Discovery
 * (Phase 4), so tags are styled but not tappable yet.
 */
export default function PostBodyText({ text, numberOfLines, color = Colors.text2, selectable }: PostBodyTextProps) {
  return (
    <AppText variant="body" color={color} numberOfLines={numberOfLines} selectable={selectable}>
      {splitHashtags(text).map((seg, i) =>
        seg.hashtag ? (
          <AppText key={i} variant="body" color={Colors.cyan} style={{ fontFamily: FontFamily.semiBold }}>
            {seg.text}
          </AppText>
        ) : (
          seg.text
        ),
      )}
    </AppText>
  );
}
