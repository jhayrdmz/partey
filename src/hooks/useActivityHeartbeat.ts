import { useEffect } from "react";
import { KEEPALIVE_INTERVAL_MS } from "@shared/constants";
import { call } from "@/services/firebase";

/** Real interactions (not just a screen left open). Capture phase, so nothing can swallow them. */
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

/**
 * Tells the server someone is using this room, so an active lobby (and the host's slot) doesn't
 * expire. Sends `keepAlive` on mount, then at most every KEEPALIVE_INTERVAL_MS while the page is
 * visible and there has been a real interaction since the last one. A screen left untouched stays
 * quiet, so a truly idle lobby still expires. For hosts and players (displays are never touched).
 */
export function useActivityHeartbeat(roomId: string | undefined, enabled = true) {
  useEffect(() => {
    if (!roomId || !enabled) return;
    let active = false;
    let last = 0;
    const send = () => {
      last = Date.now();
      active = false;
      call("keepAlive", { roomId }).catch(() => undefined); // best effort; the next interaction retries
    };
    const onActivity = () => {
      active = true;
      // First interaction after a quiet spell: report it straight away.
      if (Date.now() - last >= KEEPALIVE_INTERVAL_MS && document.visibilityState === "visible") send();
    };
    const tick = () => {
      if (active && document.visibilityState === "visible" && Date.now() - last >= KEEPALIVE_INTERVAL_MS) send();
    };
    send();
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { capture: true, passive: true }));
    const timer = window.setInterval(tick, 15_000);
    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity, { capture: true }));
      window.clearInterval(timer);
    };
  }, [roomId, enabled]);
}
