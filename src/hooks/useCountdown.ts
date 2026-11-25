import { useEffect, useState } from "react";

/** Seconds remaining until `targetMs` (ticks 4x/second). Null when no target. */
export function useCountdown(targetMs: number | null | undefined): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!targetMs) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [targetMs]);
  if (!targetMs) return null;
  return Math.max(0, Math.ceil((targetMs - now) / 1000));
}
