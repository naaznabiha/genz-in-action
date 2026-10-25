import { useEffect, useState } from "react";

import { validateUsername } from "@/lib/validation";
import { isUsernameAvailable } from "@/services/auth";

export type UsernameAvailability = "idle" | "own" | "checking" | "available" | "taken" | "unknown";

/**
 * Live, debounced (450 ms) server-side username check (spec §6.1), shared by
 * Sign up and Edit Profile. The status is derived during render; state is only
 * set when the server answers, so typing never triggers cascading renders.
 *  - "own": unchanged from `ownUsername` (Edit Profile)
 *  - "idle": the text isn't a valid username yet (the field shows that error)
 *  - "checking" until the answer for exactly this text arrives
 */
export function useUsernameAvailability(username: string, ownUsername?: string) {
  const [answer, setAnswer] = useState<{ username: string; status: "available" | "taken" | "unknown" } | null>(null);
  const skip = (ownUsername !== undefined && username === ownUsername) || Boolean(validateUsername(username));

  useEffect(() => {
    if (skip) return;
    let cancelled = false;
    const id = setTimeout(() => {
      isUsernameAvailable(username)
        .then((ok) => !cancelled && setAnswer({ username, status: ok ? "available" : "taken" }))
        .catch(() => !cancelled && setAnswer({ username, status: "unknown" }));
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [username, skip]);

  let status: UsernameAvailability;
  if (ownUsername !== undefined && username === ownUsername) status = "own";
  else if (validateUsername(username)) status = "idle";
  else status = answer?.username === username ? answer.status : "checking";

  /** The server rejected this name on submit (taken meanwhile): show it as taken. */
  const markTaken = (name: string) => setAnswer({ username: name, status: "taken" });
  return { status, markTaken };
}
