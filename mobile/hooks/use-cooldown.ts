import { useCallback, useEffect, useState } from "react";

/** Seconds-remaining countdown, used to rate-limit "Resend code" buttons. */
export function useCooldown(initialSeconds = 0) {
  const [remaining, setRemaining] = useState(initialSeconds);

  useEffect(() => {
    if (remaining <= 0) return;
    const id = setTimeout(() => setRemaining((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [remaining]);

  const start = useCallback((seconds: number) => setRemaining(seconds), []);
  return { remaining, start, active: remaining > 0 };
}
