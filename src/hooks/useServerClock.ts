import { useEffect, useState } from "react";
import { serverNow, startServerClock } from "@/services/firebase";

/**
 * Milliseconds left until a server-clock deadline, re-rendering every `tickMs`.
 * Returns null when there's no deadline. While paused, returns `pausedRemainingMs`.
 */
export function useServerCountdown(endsAtMs: number | null | undefined, opts: { paused?: boolean; pausedRemainingMs?: number | null; tickMs?: number } = {}) {
  const { paused = false, pausedRemainingMs = null, tickMs = 100 } = opts;
  const [now, setNow] = useState(() => serverNow());
  useEffect(() => {
    startServerClock();
    if (!endsAtMs || paused) return;
    const id = window.setInterval(() => setNow(serverNow()), tickMs);
    return () => window.clearInterval(id);
  }, [endsAtMs, paused, tickMs]);
  if (paused) return pausedRemainingMs;
  if (!endsAtMs) return null;
  return Math.max(0, endsAtMs - now);
}

/** True once server time passes `atMs` (e.g. Reflex Battle's GO). */
export function useServerTimeReached(atMs: number | null | undefined, paused = false) {
  const [reached, setReached] = useState(() => (atMs ? serverNow() >= atMs : false));
  useEffect(() => {
    startServerClock();
    if (!atMs || paused) {
      setReached(false);
      return;
    }
    const check = () => setReached(serverNow() >= atMs);
    check();
    // Precise single timeout + a safety interval.
    const t = window.setTimeout(check, Math.max(0, atMs - serverNow()));
    const i = window.setInterval(check, 50);
    return () => {
      window.clearTimeout(t);
      window.clearInterval(i);
    };
  }, [atMs, paused]);
  return reached;
}
