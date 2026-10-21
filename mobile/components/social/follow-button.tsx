import { useState } from "react";

import BottomSheet from "@/components/ui/bottom-sheet";
import Button, { type ButtonSize } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useFollowToggle } from "@/hooks/use-social";
import type { Relationship } from "@/types/social";

type FollowButtonProps = {
  userId: string;
  username: string;
  relationship: Relationship;
  isPrivate: boolean;
  size?: ButtonSize;
  fullWidth?: boolean;
};

/**
 * Follow / Requested / Following (spec §5.6). Public accounts follow
 * immediately; private ones get a request. Unfollowing and cancelling a
 * request ask for confirmation.
 */
export default function FollowButton({ userId, username, relationship, isPrivate, size = "md", fullWidth }: FollowButtonProps) {
  const toast = useToast();
  const toggle = useFollowToggle(userId);
  const [confirm, setConfirm] = useState(false);

  if (relationship === "self" || relationship === "blocked_by_me") return null;

  const run = (follow: boolean) =>
    toggle.mutate(follow, {
      onSuccess: (next) => {
        setConfirm(false);
        if (follow && next === "requested") toast.show(`Follow request sent to @${username}`, "success");
      },
      onError: (e) => {
        setConfirm(false);
        toast.show(e instanceof Error ? e.message : "Something went wrong.", "error");
      },
    });

  const label = relationship === "following" ? "Following" : relationship === "requested" ? "Requested" : "Follow";

  return (
    <>
      <Button
        label={label}
        size={size}
        fullWidth={fullWidth}
        variant={relationship === "none" ? "action" : "outline"}
        loading={toggle.isPending && !confirm}
        onPress={() => (relationship === "none" ? run(true) : setConfirm(true))}
        accessibilityHint={relationship === "following" ? "Unfollow" : relationship === "requested" ? "Cancel request" : undefined}
      />
      <BottomSheet
        visible={confirm}
        onClose={() => setConfirm(false)}
        dismissible={!toggle.isPending}
        title={relationship === "following" ? `Unfollow @${username}?` : `Cancel request to @${username}?`}
        message={relationship === "following" && isPrivate ? "Their posts will be hidden until they approve you again." : undefined}
      >
        <Button
          label={relationship === "following" ? "Unfollow" : "Cancel request"}
          variant="danger"
          fullWidth
          loading={toggle.isPending}
          onPress={() => run(false)}
        />
        <Button label="Keep" variant="secondary" fullWidth disabled={toggle.isPending} onPress={() => setConfirm(false)} />
      </BottomSheet>
    </>
  );
}
