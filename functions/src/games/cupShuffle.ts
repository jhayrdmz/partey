import type { CupReveal, CupRound, CupSwap, PlayerPick } from "../../../shared/engine";
import { CUP_LIMITS, CUP_POINTS, CUP_SLOT_LABELS, cupSettings, cupSpeedTier, cupStreakBonus, cupSwapMs, cupSwapRange } from "../../../shared/gameSettings";
import { fail } from "../lib/errors";
import type { GameHandler } from "../engine/types";
import { randomBetween } from "../engine/random";

export interface CupSetup {
  /** Right guesses per player so far, for the final results. */
  correct: Record<string, number>;
  /** Current run of right picks in a row per player. */
  streak?: Record<string, number>;
  /** Rounds in this game (speed tiers depend on how far in the game a round is). */
  rounds?: number;
}

/** Where the ball ends: it moves with its cup on every swap that includes its slot. */
export function finalSlot(start: number, swaps: readonly CupSwap[]): number {
  let slot = start;
  for (const { a, b } of swaps) {
    if (slot === a) slot = b;
    else if (slot === b) slot = a;
  }
  return slot;
}

/** Random swaps of two different slots, never the same pair twice in a row (so every swap visibly changes something new). */
export function pickSwaps(count: number): CupSwap[] {
  const pairs: [number, number][] = [[0, 1], [1, 2], [0, 2]];
  const swaps: CupSwap[] = [];
  let last = -1;
  for (let i = 0; i < count; i++) {
    let k = randomBetween(0, 2);
    while (k === last) k = randomBetween(0, 2);
    last = k;
    // Random direction too: which cup passes in front.
    const [a, b] = pairs[k];
    swaps.push(randomBetween(0, 1) ? { a, b } : { a: b, b: a });
  }
  return swaps;
}

const pick = (p: PlayerPick): PlayerPick => ({ playerId: p.playerId, nickname: p.nickname, avatar: p.avatar });

/**
 * Cup Shuffle: a ball is shown under one of three cups, the cups swap, players pick where it is.
 * The server makes the whole shuffle up front and every screen plays it from the server clock, so
 * all devices see the same moves at the same time. Picks before the cups stop are refused.
 */
export const cupShuffle: GameHandler<CupSetup, CupRound, { ballSlot: number }> = {
  id: "cup-shuffle",
  introMs: 10_000,
  revealMs: 7_000,
  setup(_players, _used, settings) {
    const s = cupSettings(settings as Parameters<typeof cupSettings>[0]);
    return { setup: { correct: {}, streak: {}, rounds: s.rounds }, rounds: s.rounds, contentIds: [] };
  },
  openRound(setup, round, nowMs) {
    const L = CUP_LIMITS;
    const { min, max } = cupSwapRange(round);
    const swaps = pickSwaps(randomBetween(min, max));
    const total = setup.rounds ?? CUP_LIMITS.rounds.default;
    const swapMs = cupSwapMs(round, total);
    const speedTier = cupSpeedTier(round, total);
    const ballStart = randomBetween(0, 2);
    const peekAtMs = nowMs + L.announceMs;
    const shuffleAtMs = peekAtMs + L.peekMs + L.settleMs;
    const guessAtMs = shuffleAtMs + swaps.length * swapMs + L.stopMs;
    return {
      public: { ballStart, peekAtMs, shuffleAtMs, swapMs, speedTier, swaps, guessAtMs },
      secret: { ballSlot: finalSlot(ballStart, swaps) },
      durationMs: guessAtMs - nowMs + L.guessMs,
    };
  },
  validate(answer, pub, ctx) {
    const choice = (answer as { choice?: unknown } | null)?.choice;
    if (choice !== 0 && choice !== 1 && choice !== 2) fail("invalid-argument", "Pick a cup.");
    if (ctx.nowMs !== undefined && ctx.nowMs < pub.guessAtMs - CUP_LIMITS.skewMs) fail("failed-precondition", "Wait for the cups to stop!");
    return { choice };
  },
  shiftTimes(pub, secret, deltaMs) {
    return {
      pub: { ...pub, peekAtMs: pub.peekAtMs + deltaMs, shuffleAtMs: pub.shuffleAtMs + deltaMs, guessAtMs: pub.guessAtMs + deltaMs },
      secret,
    };
  },
  score({ secret, setup, submissions, players }) {
    const choices = new Map(submissions.map((s) => [s.playerId, (s.answer as { choice: number }).choice]));
    const points: Record<string, number> = {};
    const feedback: Record<string, { correct: boolean | null; detail: string | null }> = {};
    const correct = { ...setup.correct };
    const streak = { ...setup.streak };
    const counts: [number, number, number] = [0, 0, 0];
    const results: CupReveal["results"] = [];
    const where = `${CUP_SLOT_LABELS[secret.ballSlot].toLowerCase()} cup`;
    for (const p of players) {
      const choice = choices.get(p.playerId) ?? null;
      const right = choice === secret.ballSlot;
      if (choice !== null) counts[choice]++;
      streak[p.playerId] = right ? (streak[p.playerId] ?? 0) + 1 : 0;
      const bonus = right ? cupStreakBonus(streak[p.playerId]) : 0;
      points[p.playerId] = right ? CUP_POINTS.correct + bonus : 0;
      if (right) correct[p.playerId] = (correct[p.playerId] ?? 0) + 1;
      const found = streak[p.playerId] > 1 ? `Found the ball! ${streak[p.playerId]} in a row (+${bonus})` : "Found the ball!";
      feedback[p.playerId] = { correct: right, detail: choice === null ? "No pick this round" : right ? found : `It was the ${where}` };
      results.push({ ...pick(p), choice, correct: right, streak: streak[p.playerId], bonus, points: points[p.playerId] });
    }
    // Right answers first, longest streaks first; otherwise keep the room's order.
    results.sort((a, b) => Number(b.correct) - Number(a.correct) || b.streak - a.streak);
    return { points, feedback, setup: { ...setup, correct, streak }, reveal: { ballSlot: secret.ballSlot, counts, results } satisfies CupReveal };
  },
  standingDetail(setup, playerId) {
    const n = setup.correct[playerId] ?? 0;
    return `${n} ${n === 1 ? "ball" : "balls"} found`;
  },
};
