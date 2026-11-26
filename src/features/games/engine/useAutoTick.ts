import { useEffect } from "react";
import type { PublicGameState } from "@shared/engine";
import { call, serverNow, startServerClock } from "@/services/firebase";

/**
 * When the current phase's deadline passes, ask the server to advance.
 * Host and players all run this; the server ignores duplicates and early calls.
 * A small random jitter spreads the calls out; retries cover clock skew.
 */
export function useAutoTick(roomId: string | undefined, game: PublicGameState | null | undefined, enabled = true) {
  const phase = game?.phase;
  const round = game?.round;
  const endsAt = game?.phaseEndsAtMs;
  const paused = game?.paused;
  useEffect(() => {
    if (!enabled || !roomId || !phase || round === undefined || !endsAt || paused) return;
    startServerClock();
    let cancelled = false;
    let timer: number | undefined;
    let attempts = 0;
    const fire = () => {
      if (cancelled) return;
      attempts++;
      call("tickGame", { roomId, round, phase })
        .catch(() => undefined)
        .finally(() => {
          // If the phase hasn't changed (effect not re-run), retry with backoff.
          if (!cancelled && attempts < 6) timer = window.setTimeout(fire, 800 * attempts);
        });
    };
    const wait = Math.max(0, endsAt - serverNow()) + 150 + Math.random() * 450;
    timer = window.setTimeout(fire, wait);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [roomId, phase, round, endsAt, paused, enabled]);

  // Mid-round events (Draw & Guess letter hints): same idea, at game.eventAtMs.
  const eventAt = game?.eventAtMs;
  useEffect(() => {
    if (!enabled || !roomId || phase !== "question" || round === undefined || !eventAt || paused) return;
    startServerClock();
    let cancelled = false;
    let timer: number | undefined;
    let attempts = 0;
    const fire = () => {
      if (cancelled) return;
      attempts++;
      call("tickGame", { roomId, round, phase, event: true })
        .catch(() => undefined)
        .finally(() => {
          if (!cancelled && attempts < 4) timer = window.setTimeout(fire, 700 * attempts);
        });
    };
    timer = window.setTimeout(fire, Math.max(0, eventAt - serverNow()) + 100 + Math.random() * 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [roomId, phase, round, eventAt, paused, enabled]);
}
