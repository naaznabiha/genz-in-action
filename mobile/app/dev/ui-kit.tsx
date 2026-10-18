/**
 * DEV-ONLY visual check of the design system (Phase 0.2).
 * Redirects to Home in production builds. Not a product screen.
 */
import { Redirect } from "expo-router";
import { useState, type ComponentType, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import * as Icons from "@/components/icons";
import AppText from "@/components/ui/app-text";
import Avatar from "@/components/ui/avatar";
import Button, { type ButtonVariant } from "@/components/ui/button";
import Card from "@/components/ui/card";
import { CategoryChip, FilterChip } from "@/components/ui/chip";
import EmptyState from "@/components/ui/empty-state";
import GenzLogo from "@/components/ui/genz-logo";
import IconButton from "@/components/ui/icon-button";
import ProgressBar from "@/components/ui/progress-bar";
import Screen from "@/components/ui/screen";
import ScreenHeader from "@/components/ui/screen-header";
import SegmentedTabs from "@/components/ui/segmented-tabs";
import { SkeletonCard } from "@/components/ui/skeleton";
import TextField from "@/components/ui/text-field";
import { useToast } from "@/components/ui/toast";
import Toggle from "@/components/ui/toggle";
import { CategoryColors, Colors, Spacing, Typography, type CategoryId, type TypographyVariant } from "@/constants/theme";

const BUTTON_VARIANTS: ButtonVariant[] = ["primary", "action", "secondary", "outline", "ghost", "destructive"];
const TABS = [
  { value: "saved", label: "Saved (3)" },
  { value: "liked", label: "Liked (4)" },
] as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="micro" color={Colors.text3} style={styles.sectionTitle}>
        {title.toUpperCase()}
      </AppText>
      {children}
    </View>
  );
}

export default function UiKitScreen() {
  const toast = useToast();
  const [tab, setTab] = useState<(typeof TABS)[number]["value"]>("saved");
  const [toggle, setToggle] = useState(true);
  const [filter, setFilter] = useState("All");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [bio, setBio] = useState("");

  if (!__DEV__) return <Redirect href="/" />;

  const iconEntries = Object.entries(Icons).filter(([, v]) => typeof v === "function") as [
    string,
    ComponentType<Icons.IconProps>,
  ][];

  return (
    <Screen scroll header={<ScreenHeader title="UI kit" back />}>
      <Section title="Logo">
        <View style={styles.rowWrap}>
          <GenzLogo size="lg" variant="mark" />
          <GenzLogo size="md" variant="full" />
          <GenzLogo size="md" variant="stacked" />
        </View>
      </Section>

      <Section title="Typography">
        {(Object.keys(Typography) as TypographyVariant[]).map((v) => (
          <AppText key={v} variant={v}>
            {v} — Join the movement
          </AppText>
        ))}
      </Section>

      <Section title="Buttons">
        {BUTTON_VARIANTS.map((v) => (
          <Button key={v} label={`${v} button`} variant={v} fullWidth onPress={() => toast.show(`${v} pressed`)} />
        ))}
        <View style={styles.rowWrap}>
          <Button label="Small" size="sm" variant="action" onPress={() => {}} />
          <Button label="Medium" size="md" variant="action" onPress={() => {}} />
          <Button label="Loading" loading onPress={() => {}} />
          <Button label="Disabled" disabled onPress={() => {}} />
        </View>
      </Section>

      <Section title="Text fields">
        <TextField label="Email" placeholder="you@example.com" keyboardType="email-address" value={email} onChangeText={setEmail} />
        <TextField label="Password" placeholder="••••••••" secureTextEntry value={password} onChangeText={setPassword} />
        <TextField label="Username" value="ab" onChangeText={() => {}} error="At least 3 characters" />
        <TextField
          label="Bio"
          placeholder="Tell your story..."
          multiline
          maxLength={160}
          showCount
          value={bio}
          onChangeText={setBio}
        />
        <TextField
          placeholder="Search actions, causes, people..."
          value=""
          onChangeText={() => {}}
          leftIcon={<Icons.SearchIcon size={18} color={Colors.text2} />}
        />
      </Section>

      <Section title="Icon buttons, avatars, badges">
        <View style={styles.rowWrap}>
          <IconButton icon={<Icons.SearchIcon size={18} color={Colors.text3} />} accessibilityLabel="Search" onPress={() => {}} />
          <IconButton
            icon={<Icons.BellIcon size={18} color={Colors.text3} />}
            accessibilityLabel="Notifications"
            badgeCount={4}
            onPress={() => {}}
          />
          <IconButton icon={<Icons.SettingsIcon size={17} color={Colors.text2} />} accessibilityLabel="Settings" onPress={() => {}} />
          <Avatar name="Jamie Lee" size={36} />
          <Avatar name="Maya Chen" size={48} onPress={() => toast.show("Avatar pressed")} />
          <Avatar name="Sam" size={80} />
        </View>
      </Section>

      <Section title="Segmented tabs and toggle">
        <SegmentedTabs options={TABS} value={tab} onChange={setTab} />
        <View style={styles.rowBetween}>
          <AppText variant="bodySemiBold">Private account</AppText>
          <Toggle value={toggle} onValueChange={setToggle} accessibilityLabel="Private account" />
        </View>
      </Section>

      <Section title="Chips">
        <View style={styles.rowWrap}>
          {(Object.keys(CategoryColors) as CategoryId[]).map((c) => (
            <CategoryChip key={c} category={c} small />
          ))}
        </View>
        <View style={styles.rowWrap}>
          {["All", "Climate", "Equality", "Education"].map((f) => (
            <FilterChip key={f} label={f} selected={filter === f} onPress={() => setFilter(f)} />
          ))}
        </View>
      </Section>

      <Section title="Card and progress">
        <Card tone="accent">
          <AppText variant="micro" color={Colors.cyan}>
            THIS WEEK&apos;S IMPACT (sample layout, not real data)
          </AppText>
          <View style={{ height: Spacing.md }} />
          <ProgressBar value={3} max={5} color={Colors.cyan} height={4} accessibilityLabel="Actions 3 of 5" />
          <View style={{ height: Spacing.sm }} />
          <ProgressBar value={2} max={4} color={Colors.gold} height={4} accessibilityLabel="Signed 2 of 4" />
        </Card>
      </Section>

      <Section title="Loading and empty states">
        <SkeletonCard />
        <EmptyState
          emoji="🔖"
          title="Nothing saved yet"
          subtitle="Tap the bookmark icon on any action to save it for later."
          action={<Button label="Explore Actions" variant="action" size="md" onPress={() => {}} />}
        />
      </Section>

      <Section title="Toasts">
        <View style={styles.rowWrap}>
          <Button label="Info" size="sm" variant="secondary" onPress={() => toast.show("🔖 Saved!")} />
          <Button label="Success" size="sm" variant="secondary" onPress={() => toast.show("Profile updated", "success")} />
          <Button label="Error" size="sm" variant="secondary" onPress={() => toast.show("Network error. Try again.", "error")} />
        </View>
      </Section>

      <Section title={`Icons (${iconEntries.length})`}>
        <View style={styles.rowWrap}>
          {iconEntries.map(([name, Icon]) => (
            <View key={name} style={styles.iconCell}>
              <Icon size={22} color={Colors.text2} />
              <AppText variant="micro" color={Colors.text3} numberOfLines={1}>
                {name.replace("Icon", "")}
              </AppText>
            </View>
          ))}
        </View>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.md, marginBottom: Spacing.xxl },
  sectionTitle: { letterSpacing: 1 },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: Spacing.md },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  iconCell: { width: 72, alignItems: "center", gap: 4 },
});
