import type { ReactNode } from "react";

import EmptyState from "@/components/ui/empty-state";
import Screen from "@/components/ui/screen";
import ScreenHeader from "@/components/ui/screen-header";

type ComingSoonScreenProps = {
  title: string;
  emoji: string;
  heading: string;
  message: string;
  action?: ReactNode;
};

/**
 * Honest destination for a global action whose feature ships in a later phase
 * (Search, Notifications). It says what will be here instead of showing fake data.
 * Replace each usage with the real screen when its phase lands.
 */
export default function ComingSoonScreen({ title, emoji, heading, message, action }: ComingSoonScreenProps) {
  return (
    <Screen header={<ScreenHeader title={title} back />} edges={["top", "bottom"]}>
      <EmptyState emoji={emoji} title={heading} subtitle={message} action={action} />
    </Screen>
  );
}
