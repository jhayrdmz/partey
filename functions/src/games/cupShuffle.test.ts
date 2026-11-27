import { describe, expect, it } from "vitest";
import type { CupReveal } from "../../../shared/engine";
import { CUP_LIMITS, cupSpeedTier, cupStreakBonus, cupSwapMs, cupSwapRange } from "../../../shared/gameSettings";
import { cupShuffle, finalSlot, pickSwaps, type CupSetup } from "./cupShuffle";

const players = ["a", "b", "c", "d"].map((id) => ({ playerId: id, nickname: id.toUpperCase(), avatar: "mango" }));
const setup: CupSetup = { correct: {}, streak: {}, rounds: 5 };
const NOW = 1_000_000;

describe("shuffle", () => {
  it("swaps two different slots, never the same pair twice in a row", () => {
    const swaps = pickSwaps(500);
    expect(swaps).toHaveLength(500);
    const key = ({ a, b }: { a: number; b: number }) => [a, b].sort().join();
    for (const [i, s] of swaps.entries()) {
      expect(s.a).not.toBe(s.b);
      expect([s.a, s.b].every((x) => x >= 0 && x <= 2)).toBe(true);
      if (i > 0) expect(key(s)).not.toBe(key(swaps[i - 1]));
    }
  });

  it("follows the ball through the swaps", () => {
    expect(finalSlot(0, [])).toBe(0);
    expect(finalSlot(0, [{ a: 0, b: 1 }])).toBe(1);
    expect(finalSlot(0, [{ a: 1, b: 2 }])).toBe(0);
    expect(finalSlot(2, [{ a: 0, b: 2 }, { a: 1, b: 0 }, { a: 2, b: 1 }])).toBe(2);
    expect(finalSlot(2, [{ a: 0, b: 2 }, { a: 1, b: 0 }])).toBe(1);
  });

  it("speeds up once 30%, 60% and 80% of the rounds are played", () => {
    // 10 rounds: 1–3, 4–6, 7–8, 9–10.
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((r) => cupSpeedTier(r, 10))).toEqual([0, 0, 0, 1, 1, 1, 2, 2, 3, 3]);
    // 5 rounds: 1–2, 3, 4, 5.
    expect([1, 2, 3, 4, 5].map((r) => cupSpeedTier(r, 5))).toEqual([0, 0, 1, 2, 3]);
    expect([1, 2, 3].map((r) => cupSpeedTier(r, 3))).toEqual([0, 1, 2]);
    expect(cupSpeedTier(1, 1)).toBe(0);
    const ms = CUP_LIMITS.speedTiers.map((t) => t.swapMs);
    for (let i = 1; i < ms.length; i++) expect(ms[i]).toBeLessThan(ms[i - 1]);
    expect(cupSwapMs(5, 5)).toBe(ms[3]);
  });

  it("gets more swaps each round", () => {
    expect(cupSwapRange(1)).toEqual({ min: 3, max: 5 });
    expect(cupSwapRange(2)).toEqual({ min: 6, max: 8 });
    expect(cupSwapRange(5)).toEqual({ min: 15, max: 17 });
    expect(cupSwapRange(6)).toEqual({ min: 18, max: 20 });
    expect(cupSwapRange(8)).toEqual({ min: 20, max: 22 });
    expect(cupSwapRange(40).max).toBe(30);
  });
});

describe("rounds", () => {
  it("shows the ball, shuffles within the round's range, then opens picks with time to answer", () => {
    for (const r of [1, 3, 6]) {
      const { public: pub, secret, durationMs } = cupShuffle.openRound(setup, r, NOW, players);
      const { min, max } = cupSwapRange(r);
      expect(pub.swaps.length).toBeGreaterThanOrEqual(min);
      expect(pub.swaps.length).toBeLessThanOrEqual(max);
      expect(pub.swapMs).toBe(cupSwapMs(r, 5));
      expect(pub.speedTier).toBe(cupSpeedTier(r, 5));
      expect(pub.peekAtMs).toBe(NOW + CUP_LIMITS.announceMs);
      expect(pub.shuffleAtMs).toBe(pub.peekAtMs + CUP_LIMITS.peekMs + CUP_LIMITS.settleMs);
      expect(pub.guessAtMs).toBe(pub.shuffleAtMs + pub.swaps.length * pub.swapMs + CUP_LIMITS.stopMs);
      expect(NOW + durationMs).toBe(pub.guessAtMs + CUP_LIMITS.guessMs);
      expect(secret.ballSlot).toBe(finalSlot(pub.ballStart, pub.swaps));
      // The answer never goes in the public round data.
      expect(Object.keys(pub)).not.toContain("ballSlot");
    }
  });

  it("shifts every time after a pause", () => {
    const { public: pub, secret } = cupShuffle.openRound(setup, 1, NOW, players);
    const shifted = cupShuffle.shiftTimes!(pub, secret, 5_000).pub;
    expect([shifted.peekAtMs, shifted.shuffleAtMs, shifted.guessAtMs]).toEqual([pub.peekAtMs + 5_000, pub.shuffleAtMs + 5_000, pub.guessAtMs + 5_000]);
    expect(shifted.swaps).toEqual(pub.swaps);
  });
});

describe("validation", () => {
  const { public: pub } = cupShuffle.openRound(setup, 1, NOW, players);
  const ctx = (nowMs?: number) => ({ playerId: "a", setup, nowMs });

  it("accepts cup 0–2 once the cups stop", () => {
    for (const choice of [0, 1, 2]) expect(cupShuffle.validate({ choice }, pub, ctx(pub.guessAtMs))).toEqual({ choice });
  });

  it("refuses other picks", () => {
    for (const bad of [{ choice: 3 }, { choice: -1 }, { choice: 1.5 }, { choice: "1" }, {}, null]) {
      expect(() => cupShuffle.validate(bad, pub, ctx(pub.guessAtMs))).toThrow(/Pick a cup/);
    }
  });

  it("refuses picks while the cups are still moving", () => {
    expect(() => cupShuffle.validate({ choice: 0 }, pub, ctx(pub.shuffleAtMs))).toThrow(/cups to stop/);
    expect(() => cupShuffle.validate({ choice: 0 }, pub, ctx(pub.guessAtMs - CUP_LIMITS.skewMs - 1))).toThrow(/cups to stop/);
    expect(cupShuffle.validate({ choice: 0 }, pub, ctx(pub.guessAtMs - CUP_LIMITS.skewMs))).toEqual({ choice: 0 });
  });
});

describe("scoring", () => {
  const opened = cupShuffle.openRound(setup, 1, NOW, players);
  const secret = { ballSlot: 2 };
  const sub = (playerId: string, choice: number) => ({ playerId, answer: { choice }, submittedAtMs: opened.public.guessAtMs + 1_000 });

  it("gives 100 for the right cup and 0 for a wrong cup or no pick, right answers first", () => {
    const scored = cupShuffle.score({
      pub: opened.public,
      secret,
      setup: { correct: { b: 2 }, streak: { b: 2, a: 3 }, rounds: 5 },
      submissions: [sub("a", 0), sub("b", 2), sub("d", 2)],
      players,
      allPlayers: players,
      openedAtMs: NOW,
      durationMs: opened.durationMs,
    });
    // b: 3rd in a row (+50); d: first (no bonus); a's streak ends.
    expect(scored.points).toEqual({ a: 0, b: 150, c: 0, d: 100 });
    const r = scored.reveal as CupReveal;
    expect(r.ballSlot).toBe(2);
    expect(r.counts).toEqual([1, 0, 2]);
    expect(r.results.map((x) => [x.playerId, x.choice, x.correct, x.streak, x.bonus])).toEqual([
      ["b", 2, true, 3, 50],
      ["d", 2, true, 1, 0],
      ["a", 0, false, 0, 0],
      ["c", null, false, 0, 0],
    ]);
    expect(scored.feedback.b.detail).toBe("Found the ball! 3 in a row (+50)");
    expect(scored.feedback.d.detail).toBe("Found the ball!");
    expect(scored.feedback.a.detail).toBe("It was the right cup");
    expect(scored.feedback.c.detail).toBe("No pick this round");
    expect(scored.setup).toEqual({ correct: { b: 3, d: 1 }, streak: { a: 0, b: 3, c: 0, d: 1 }, rounds: 5 });
    expect(cupShuffle.standingDetail!(scored.setup as CupSetup, "b")).toBe("3 balls found");
    expect(cupShuffle.standingDetail!(scored.setup as CupSetup, "d")).toBe("1 ball found");
  });

  it("streak bonus: +25 per round in a row after the first, up to +100", () => {
    expect([1, 2, 3, 4, 5, 6, 9].map(cupStreakBonus)).toEqual([0, 25, 50, 75, 100, 100, 100]);
  });

  it("setup uses the host's rounds, with a default", () => {
    expect(cupShuffle.setup(players, new Set(), { rounds: 8, maxPlayers: 24 }).rounds).toBe(8);
    expect(cupShuffle.setup(players, new Set()).rounds).toBe(CUP_LIMITS.rounds.default);
  });
});
