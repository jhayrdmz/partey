import { useEffect, useMemo, useState } from "react";
import type { CupRound, CupSwap, PublicGameState } from "@shared/engine";
import { CUP_LIMITS } from "@shared/gameSettings";
import { serverNow, startServerClock } from "@/services/firebase";

/* ─── Timeline ─────────────────────────────────────────────────────────── */

export type CupStage = "announce" | "peek" | "shuffle" | "guess";

export interface CupPose {
  /** Horizontal position in slots (0 left … 2 right; fractional mid-swap). */
  x: number;
  /** 0 = on the table, 1 = fully lifted. */
  lift: number;
  /** Mid-swap: +1 passes in front, −1 behind. */
  depth: number;
}

const LIFT_MS = 350;
const ease = (p: number) => 0.5 - Math.cos(Math.PI * Math.min(1, Math.max(0, p))) / 2;

/** cupAt[slot] = which cup (0–2) is there after the first `k` swaps. Cups start in their own slot. */
export function arrangements(swaps: readonly CupSwap[]): number[][] {
  const out = [[0, 1, 2]];
  for (const { a, b } of swaps) {
    const next = [...out[out.length - 1]];
    [next[a], next[b]] = [next[b], next[a]];
    out.push(next);
  }
  return out;
}

/**
 * Where every cup is at server time `now`. A pure function of the round data and the clock, so the
 * big screen (and any reconnecting screen) shows the same moment of the same shuffle.
 */
export function cupPoses(pub: CupRound, order: number[][], now: number): { stage: CupStage; poses: CupPose[]; swap: number } {
  const poses: CupPose[] = [0, 1, 2].map((c) => ({ x: c, lift: 0, depth: 0 }));
  if (now < pub.peekAtMs) return { stage: "announce", poses, swap: 0 };
  if (now < pub.shuffleAtMs) {
    // The ball's cup (cup id = its start slot) lifts, stays up, and comes back down before the swaps.
    const t = now - pub.peekAtMs;
    const down = pub.peekAtMs + CUP_LIMITS.peekMs;
    poses[pub.ballStart].lift = now < down ? ease(t / LIFT_MS) : 1 - ease((now - down) / LIFT_MS);
    return { stage: "peek", poses, swap: 0 };
  }
  const k = Math.floor((now - pub.shuffleAtMs) / pub.swapMs);
  if (k >= pub.swaps.length) {
    order[pub.swaps.length].forEach((cup, slot) => (poses[cup].x = slot));
    return { stage: now >= pub.guessAtMs ? "guess" : "shuffle", poses, swap: pub.swaps.length };
  }
  const before = order[k];
  before.forEach((cup, slot) => (poses[cup].x = slot));
  const { a, b } = pub.swaps[k];
  const p = ease((now - pub.shuffleAtMs - k * pub.swapMs) / pub.swapMs);
  const arc = Math.sin(Math.PI * p);
  const front = before[a];
  const back = before[b];
  poses[front] = { x: a + (b - a) * p, lift: 0, depth: arc };
  poses[back] = { x: b + (a - b) * p, lift: 0, depth: -arc };
  return { stage: "shuffle", poses, swap: k + 1 };
}

/**
 * While paused, the moment the game stopped on the round's own schedule. The public state hides the
 * deadline during a pause, but a round always ends `guessMs` after the cups stop.
 */
function pausedAt(game: PublicGameState): number | null {
  const pub = game.round_data as CupRound | null;
  if (!game.paused || !pub || game.remainingMs === null) return null;
  return pub.guessAtMs + CUP_LIMITS.guessMs - game.remainingMs;
}

/** Server time, every animation frame (frozen while the game is paused). */
export function useFrameClock(game: PublicGameState, active = true) {
  const frozen = pausedAt(game);
  const [now, setNow] = useState(() => serverNow());
  useEffect(() => {
    startServerClock();
    if (!active || frozen !== null) return;
    let raf = 0;
    const loop = () => {
      setNow(serverNow());
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active, frozen]);
  return frozen ?? now;
}

/** Ms since mount, every animation frame, until `untilMs`. */
export function useElapsed(untilMs: number) {
  const [start] = useState(() => performance.now());
  const [t, setT] = useState(0);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const e = performance.now() - start;
      setT(Math.min(e, untilMs));
      if (e < untilMs) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [start, untilMs]);
  return t;
}

export function useCupTimeline(game: PublicGameState) {
  const pub = game.round_data as CupRound;
  const order = useMemo(() => arrangements(pub.swaps), [pub.swaps]);
  const now = useFrameClock(game, serverNow() < pub.guessAtMs + 1_000);
  return { pub, order, ...cupPoses(pub, order, now) };
}
