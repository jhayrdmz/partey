import type { HoldReveal, HoldRound, PlayerPick } from "../../../shared/engine";
import { HOLD_LIMITS, HOLD_RANGES, formatHold, holdPoints, holdSettings, holdVerdict, HOLD_VERDICT_LABELS, type HoldRange } from "../../../shared/gameSettings";
import { fail } from "../lib/errors";
import type { GameHandler } from "../engine/types";
import { randomBetween } from "../engine/random";

export interface HoldSetup {
  /** Target per round, ms (whole seconds). */
  targets: number[];
  /** Each player's closest hold so far (ms off target), for the final results. */
  best: Record<string, number>;
}

/** Random whole-second targets in the range, never the same twice in a row (when the range allows). */
export function pickTargets(rounds: number, range: HoldRange): number[] {
  const { min, max } = HOLD_RANGES[range];
  const targets: number[] = [];
  for (let i = 0; i < rounds; i++) {
    let s = randomBetween(min, max);
    if (max > min) while (s * 1000 === targets[i - 1]) s = randomBetween(min, max);
    targets.push(s * 1000);
  }
  return targets;
}

/** Ranks by distance from the target; equal distances share a rank (1, 1, 3…). */
export function rankHolds<T extends { diffMs: number }>(holds: T[]): (T & { rank: number })[] {
  const sorted = [...holds].sort((a, b) => a.diffMs - b.diffMs);
  let rank = 0;
  return sorted.map((h, i) => {
    if (i === 0 || h.diffMs !== sorted[i - 1].diffMs) rank = i + 1;
    return { ...h, rank };
  });
}

const pick = (p: PlayerPick): PlayerPick => ({ playerId: p.playerId, nickname: p.nickname, avatar: p.avatar });

/**
 * Perfectly Hold: hold the button for the target time, no clock. Each phone measures its own hold
 * with performance.now() (network latency never counts) and sends the duration. The server checks
 * the round, that the hold fits the time since GO, and that it's within the allowed length.
 */
export const perfectlyHold: GameHandler<HoldSetup, HoldRound, null> = {
  id: "perfectly-hold",
  introMs: 10_000,
  revealMs: 9_000,
  showAnswerers: true,
  setup(_players, _used, settings) {
    const s = holdSettings(settings as Parameters<typeof holdSettings>[0]);
    return { setup: { targets: pickTargets(s.rounds, s.range), best: {} }, rounds: s.rounds, contentIds: [] };
  },
  openRound(setup, round, nowMs, players) {
    const targetMs = setup.targets[round - 1] ?? 10_000;
    const goAtMs = nowMs + HOLD_LIMITS.announceMs + HOLD_LIMITS.countdownMs;
    const maxHoldMs = targetMs + HOLD_LIMITS.overtimeMs;
    return {
      public: { targetMs, goAtMs, maxHoldMs, players: players.map(pick) },
      secret: null,
      // Countdown + time to press + the longest hold + a moment for the last answer to arrive.
      durationMs: goAtMs - nowMs + HOLD_LIMITS.pressWindowMs + maxHoldMs + 1_000,
    };
  },
  validate(answer, pub, ctx) {
    const raw = (answer as { holdMs?: unknown } | null)?.holdMs;
    if (typeof raw !== "number" || !Number.isFinite(raw)) fail("invalid-argument", "Invalid hold.");
    // Results show hundredths (9.98s), so holds are kept to the hundredth too: what's shown is what's
    // ranked, and equal times on screen share a placement.
    const holdMs = Math.round(raw / HOLD_LIMITS.precisionMs) * HOLD_LIMITS.precisionMs;
    if (holdMs < HOLD_LIMITS.minHoldMs) fail("invalid-argument", "That was a tap. Press and hold!");
    if (holdMs > pub.maxHoldMs) fail("invalid-argument", "Invalid hold.");
    // A hold can't have started before GO (allowing for device clock drift).
    if (ctx.nowMs !== undefined && holdMs > ctx.nowMs - pub.goAtMs + HOLD_LIMITS.skewMs) fail("invalid-argument", "Invalid hold.");
    return { holdMs };
  },
  shiftTimes(pub, secret, deltaMs) {
    return { pub: { ...pub, goAtMs: pub.goAtMs + deltaMs }, secret };
  },
  score({ pub, setup, submissions, players }) {
    const byId = new Map(players.map((p) => [p.playerId, p]));
    const holds = submissions
      .filter((s) => byId.has(s.playerId))
      .map((s) => {
        const holdMs = (s.answer as { holdMs: number }).holdMs;
        return { playerId: s.playerId, holdMs, diffMs: Math.abs(holdMs - pub.targetMs) };
      });
    const ranked = rankHolds(holds);

    const points: Record<string, number> = {};
    const feedback: Record<string, { correct: boolean | null; detail: string | null }> = {};
    const best = { ...setup.best };
    const results: HoldReveal["results"] = [];
    for (const h of ranked) {
      const p = holdPoints(h.rank);
      points[h.playerId] = p;
      const verdict = holdVerdict(h.holdMs, pub.targetMs);
      feedback[h.playerId] = { correct: h.diffMs <= 500, detail: `${formatHold(h.holdMs)} · ${HOLD_VERDICT_LABELS[verdict]} · #${h.rank}` };
      best[h.playerId] = Math.min(best[h.playerId] ?? Infinity, h.diffMs);
      results.push({ ...pick(byId.get(h.playerId)!), holdMs: h.holdMs, diffMs: h.diffMs, rank: h.rank, points: p });
    }
    for (const p of players) {
      if (points[p.playerId] !== undefined) continue;
      feedback[p.playerId] = { correct: false, detail: "No hold this round" };
      results.push({ ...pick(p), holdMs: null, diffMs: null, rank: null, points: 0 });
    }
    return { points, feedback, setup: { ...setup, best }, reveal: { targetMs: pub.targetMs, results } satisfies HoldReveal };
  },
  standingDetail(setup, playerId) {
    const b = setup.best[playerId];
    return b === undefined ? undefined : `Best: ${formatHold(b)} off`;
  },
};
