import type { ReflexReveal, ReflexRound } from "../../../shared/engine";
import { fail } from "../lib/errors";
import type { GameHandler } from "../engine/types";
import { randomBetween } from "../engine/random";

const ROUNDS = 5;
const MIN_DELAY_MS = 2_000;
const MAX_DELAY_MS = 6_000;
/** Time after GO that taps are accepted. */
const WINDOW_MS = 3_000;
export const REFLEX_RANK_POINTS = [500, 350, 250];
export const REFLEX_OTHER_POINTS = 150;

/**
 * Reaction = server receive time − GO time. A tap received before GO is a false
 * start (0 points). Network latency is included for everyone alike.
 */
export const reflex: GameHandler<{ rounds: number }, ReflexRound, null> = {
  id: "reflex-battle",
  introMs: 10_000,
  revealMs: 6_000,
  setup() {
    return { setup: { rounds: ROUNDS }, rounds: ROUNDS, contentIds: [] };
  },
  openRound(_setup, _round, nowMs) {
    const delay = randomBetween(MIN_DELAY_MS, MAX_DELAY_MS);
    return { public: { goAtMs: nowMs + delay }, secret: null, durationMs: delay + WINDOW_MS };
  },
  validate(answer) {
    if ((answer as { tap?: unknown } | null)?.tap !== true) fail("invalid-argument", "Invalid tap.");
    return { tap: true };
  },
  shiftTimes(pub, secret, deltaMs) {
    return { pub: { goAtMs: pub.goAtMs + deltaMs }, secret };
  },
  score({ pub, submissions, players }) {
    const byId = new Map(players.map((p) => [p.playerId, p]));
    const valid = submissions
      .filter((s) => s.submittedAtMs >= pub.goAtMs)
      .map((s) => ({ playerId: s.playerId, reactionMs: s.submittedAtMs - pub.goAtMs }))
      .sort((a, b) => a.reactionMs - b.reactionMs);
    const falseStarts = new Set(submissions.filter((s) => s.submittedAtMs < pub.goAtMs).map((s) => s.playerId));

    const points: Record<string, number> = {};
    const feedback: Record<string, { correct: boolean | null; detail: string | null }> = {};
    const results: ReflexReveal["results"] = [];
    valid.forEach((v, rank) => {
      const p = REFLEX_RANK_POINTS[rank] ?? REFLEX_OTHER_POINTS;
      points[v.playerId] = p;
      feedback[v.playerId] = { correct: true, detail: `${v.reactionMs} ms · #${rank + 1}` };
      const player = byId.get(v.playerId);
      if (player) results.push({ ...player, reactionMs: v.reactionMs, falseStart: false, points: p });
    });
    for (const id of falseStarts) {
      feedback[id] = { correct: false, detail: "False start! Too early." };
      const player = byId.get(id);
      if (player) results.push({ ...player, reactionMs: null, falseStart: true, points: 0 });
    }
    for (const p of players) feedback[p.playerId] ??= { correct: false, detail: "Too slow — no tap" };
    return { points, feedback, reveal: { results } satisfies ReflexReveal };
  },
};
