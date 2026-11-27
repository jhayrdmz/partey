import type { PlayerPick, RushChoice, RushReveal, RushRound } from "../../../shared/engine";
import { RUSH_LIMITS, rushAllowed, rushMultiplier, rushPoints, rushSettings } from "../../../shared/gameSettings";
import { fail } from "../lib/errors";
import type { GameHandler } from "../engine/types";
import { randomBetween } from "../engine/random";

export interface RushSetup {
  /** numbers[0] is the first number shown; numbers[r] is revealed at the end of round r. Server-only. */
  numbers: number[];
  /** Right predictions in a row per player. */
  streak: Record<string, number>;
  /** Longest streak per player this game, for the final results. */
  best: Record<string, number>;
  /** This game's points per player (the reveal's leaderboard). */
  totals: Record<string, number>;
  /** Time to predict, ms. */
  roundMs: number;
}

/** `count` three-digit numbers, each different from the one before. */
export function pickNumbers(count: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    let n = randomBetween(RUSH_LIMITS.min, RUSH_LIMITS.max);
    while (n === out[i - 1]) n = randomBetween(RUSH_LIMITS.min, RUSH_LIMITS.max);
    out.push(n);
  }
  return out;
}

const pick = (p: PlayerPick): PlayerPick => ({ playerId: p.playerId, nickname: p.nickname, avatar: p.avatar });

/**
 * Number Rush: higher or lower than the number on screen? The whole sequence is drawn when the game
 * starts and kept in the server-only setup; each round publishes only the current number, and the next
 * one appears in the reveal. Scoring and streaks are worked out here, never on a device.
 */
export const numberRush: GameHandler<RushSetup, RushRound, { next: number }> = {
  id: "number-rush",
  introMs: 10_000,
  revealMs: 9_000,
  setup(_players, _used, settings) {
    const s = rushSettings(settings as Parameters<typeof rushSettings>[0]);
    return { setup: { numbers: pickNumbers(s.rounds + 1), streak: {}, best: {}, totals: {}, roundMs: s.seconds * 1000 }, rounds: s.rounds, contentIds: [] };
  },
  openRound(setup, round, _nowMs, players) {
    const onStreak = players
      .filter((p) => (setup.streak[p.playerId] ?? 0) > 0)
      .map((p) => ({ ...pick(p), streak: setup.streak[p.playerId] }))
      .sort((a, b) => b.streak - a.streak);
    return {
      public: { current: setup.numbers[round - 1], onStreak },
      secret: { next: setup.numbers[round] },
      durationMs: setup.roundMs,
    };
  },
  validate(answer, pub) {
    const choice = (answer as { choice?: unknown } | null)?.choice;
    if (choice !== "higher" && choice !== "lower") fail("invalid-argument", "Pick HIGHER or LOWER.");
    if (!rushAllowed(pub.current)[choice]) fail("invalid-argument", choice === "higher" ? `Nothing is higher than ${pub.current}.` : `Nothing is lower than ${pub.current}.`);
    return { choice };
  },
  score({ pub, secret, setup, submissions, players }) {
    const direction: RushChoice = secret.next > pub.current ? "higher" : "lower";
    const choices = new Map(submissions.map((s) => [s.playerId, (s.answer as { choice: RushChoice }).choice]));
    const streak = { ...setup.streak };
    const best = { ...setup.best };
    const totals = { ...setup.totals };
    const points: Record<string, number> = {};
    const feedback: Record<string, { correct: boolean | null; detail: string | null }> = {};
    const results: RushReveal["results"] = [];
    for (const p of players) {
      const choice = choices.get(p.playerId) ?? null;
      const correct = choice === direction;
      // A wrong or missed prediction resets the streak.
      streak[p.playerId] = correct ? (streak[p.playerId] ?? 0) + 1 : 0;
      const s = streak[p.playerId];
      best[p.playerId] = Math.max(best[p.playerId] ?? 0, s);
      const pts = correct ? rushPoints(s) : 0;
      points[p.playerId] = pts;
      totals[p.playerId] = (totals[p.playerId] ?? 0) + pts;
      const multiplier = correct ? rushMultiplier(s) : 0;
      feedback[p.playerId] = {
        correct,
        detail: choice === null ? "No prediction this round" : correct ? (s > 1 ? `${s} in a row · ${multiplier}x` : "Nice call!") : `It went ${direction}`,
      };
      results.push({ ...pick(p), choice, correct, streak: s, multiplier, points: pts, total: totals[p.playerId] });
    }
    // Most points this round first (longest streaks), then the room's order.
    results.sort((a, b) => b.points - a.points || b.streak - a.streak);
    return {
      points,
      feedback,
      setup: { ...setup, streak, best, totals },
      reveal: { previous: pub.current, next: secret.next, direction, results } satisfies RushReveal,
    };
  },
  standingDetail(setup, playerId) {
    const b = setup.best[playerId] ?? 0;
    return `Best streak: ${b}`;
  },
};
