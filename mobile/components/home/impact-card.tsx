import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";

import { FireIcon, LightningIcon } from "@/components/icons";
import AppText from "@/components/ui/app-text";
import Button from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Colors, FontFamily, Radius, Spacing } from "@/constants/theme";
import { useMyImpactSummary } from "@/hooks/use-impact";

/**
 * "This Week's Impact" (prototype HomeScreen weekly card, spec FR-07).
 * Shows only what the server derived from the activity ledger:
 *  - no approved scoring formula → a "Getting started" state, no points;
 *  - approved formula → points and actions for the formula's week.
 * Streak and rank render only when the server returns them (never, until approved).
 * The prototype's sample numbers and x/5 goals are intentionally not reproduced.
 */
export default function ImpactCard() {
  const { data, isPending, isError, error, refetch, isRefetching } = useMyImpactSummary();

  return (
    <LinearGradient colors={[Colors.elevated, Colors.deep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
      <AppText style={styles.eyebrow} color={Colors.cyan} accessibilityRole="header">
        THIS WEEK&apos;S IMPACT
      </AppText>

      {isPending ? (
        <View style={styles.gap} accessibilityLabel="Loading your impact">
          <Skeleton width={140} height={30} />
          <Skeleton width="80%" height={12} />
        </View>
      ) : isError ? (
        <View style={styles.gap}>
          <AppText variant="body" color={Colors.text2}>
            Couldn&apos;t load your impact. {error.message}
          </AppText>
          <Button label="Try again" onPress={() => void refetch()} loading={isRefetching} variant="secondary" size="sm" style={styles.retry} />
        </View>
      ) : data.formula_status !== "approved" || data.impact_points === null ? (
        <View style={styles.gap}>
          <View style={styles.headlineRow}>
            <LightningIcon size={22} color={Colors.cyan} />
            <AppText style={styles.headline}>Getting started</AppText>
          </View>
          <AppText variant="body" color={Colors.text2}>
            {data.total_actions === 0
              ? "You haven't taken any actions yet. Actions you take in the app will count toward your impact here."
              : `${data.total_actions} ${data.total_actions === 1 ? "action" : "actions"} recorded. Impact points appear once scoring goes live.`}
          </AppText>
        </View>
      ) : (
        <View style={styles.gap}>
          <View style={styles.scoreRow}>
            <View style={styles.headlineRow}>
              <AppText style={styles.points}>+{data.impact_points}</AppText>
              <AppText variant="body" color={Colors.text2}>
                pts
              </AppText>
            </View>
            {data.streak ? (
              <View style={styles.streak}>
                <FireIcon size={12} color={Colors.cyan} />
                <AppText style={styles.streakText} color={Colors.cyan}>
                  {data.streak}-day streak
                </AppText>
              </View>
            ) : null}
          </View>
          <AppText variant="caption" color={Colors.text3}>
            {data.period_actions ?? 0} {data.period_actions === 1 ? "action" : "actions"} this week
            {data.rank ? ` · Rank #${data.rank}` : ""}
          </AppText>
        </View>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: "rgba(0,255,255,0.18)",
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  eyebrow: { fontFamily: FontFamily.semiBold, fontSize: 11, lineHeight: 14, letterSpacing: 1 },
  gap: { gap: Spacing.sm },
  headlineRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  headline: { fontFamily: FontFamily.displayBlack, fontSize: 22, lineHeight: 28 },
  scoreRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  points: { fontFamily: FontFamily.displayBlack, fontSize: 30, lineHeight: 36 },
  streak: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.cyanTint,
  },
  streakText: { fontFamily: FontFamily.bold, fontSize: 12, lineHeight: 16 },
  retry: { alignSelf: "flex-start" },
});
