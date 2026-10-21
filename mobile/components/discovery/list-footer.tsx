import { ActivityIndicator, StyleSheet } from "react-native";

import AppText from "@/components/ui/app-text";
import Button from "@/components/ui/button";
import { Colors, Spacing } from "@/constants/theme";

type ListFooterProps = {
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
  hasNextPage: boolean;
  itemCount: number;
  onRetry: () => void;
  /** Shown once everything is loaded (omit for nothing). */
  endLabel?: string;
};

/** Footer for paginated lists: spinner while loading the next page, retry on failure, "the end". */
export default function ListFooter({ isFetchingNextPage, isFetchNextPageError, hasNextPage, itemCount, onRetry, endLabel }: ListFooterProps) {
  if (isFetchingNextPage) return <ActivityIndicator color={Colors.cyan} style={styles.footer} accessibilityLabel="Loading more" />;
  if (isFetchNextPageError) return <Button label="Couldn't load more — retry" variant="ghost" size="sm" onPress={onRetry} style={styles.footer} />;
  if (itemCount > 0 && !hasNextPage && endLabel)
    return (
      <AppText variant="caption" color={Colors.text3} align="center" style={styles.footer}>
        {endLabel}
      </AppText>
    );
  return null;
}

const styles = StyleSheet.create({ footer: { marginVertical: Spacing.xl } });
