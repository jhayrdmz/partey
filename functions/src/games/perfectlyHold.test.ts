import { describe, expect, it } from "vitest";
import type { HoldReveal } from "../../../shared/engine";
import { HOLD_LIMITS, HOLD_RANGES, HOLD_RANGE_OPTIONS, holdVerdict } from "../../../shared/gameSettings";
import { perfectlyHold, pickTargets, rankHolds, type HoldSetup } from "./perfectlyHold";

const players = ["a", "b", "c", "d", "e"].map((id) => ({ playerId: id, nickname: id.toUpperCase(), avatar: "mango" }));

function round(targetMs = 10_000) {
  const setup: HoldSetup = { targets: [targetMs], best: {} };
  const opened = perfectlyHold.openRound(setup, 1, 1_000_000, players);
  return { setup, opened, pub: opened.public };
}

describe("targets", () => {
  it("are whole seconds inside the chosen range and never repeat back to back", () => {
    for (const range of HOLD_RANGE_OPTIONS) {
      const t = pickTargets(200, range);
      expect(t).toHaveLength(200);
      for (const ms of t) {
        expect(ms % 1000).toBe(0);
        expect(ms / 1000).toBeGreaterThanOrEqual(HOLD_RANGES[range].min);
        expect(ms / 1000).toBeLessThanOrEqual(HOLD_RANGES[range].max);
      }
      for (let i = 1; i < t.length; i++) expect(t[i]).not.toBe(t[i - 1]);
    }
  });

  it("setup uses the host's rounds and range, with defaults", () => {
    const s = perfectlyHold.setup(players, new Set(), { rounds: 3, range: "long", maxPlayers: 24 });
    expect(s.rounds).toBe(3);
    expect(s.setup.targets.every((ms) => ms >= 12_000 && ms <= 15_000)).toBe(true);
    expect(perfectlyHold.setup(players, new Set()).rounds).toBe(HOLD_LIMITS.rounds.default);
  });
});

describe("rounds", () => {
  it("gives everyone the same target, a countdown before GO and room for the longest hold", () => {
    const { opened, pub } = round(9_000);
    expect(pub.targetMs).toBe(9_000);
    expect(pub.goAtMs).toBe(1_000_000 + HOLD_LIMITS.announceMs + HOLD_LIMITS.countdownMs);
    expect(pub.maxHoldMs).toBe(9_000 + HOLD_LIMITS.overtimeMs);
    expect(pub.players.map((p) => p.playerId)).toEqual(["a", "b", "c", "d", "e"]);
    expect(1_000_000 + opened.durationMs).toBeGreaterThan(pub.goAtMs + pub.maxHoldMs);
  });

  it("shifts GO after a pause", () => {
    const { pub } = round();
    expect(perfectlyHold.shiftTimes!(pub, null, 4_000).pub.goAtMs).toBe(pub.goAtMs + 4_000);
  });
});

describe("validation", () => {
  const { setup, pub } = round();
  const ctx = (nowMs?: number) => ({ playerId: "a", setup, nowMs });

  it("accepts a plausible hold and rounds it to the hundredth of a second", () => {
    expect(perfectlyHold.validate({ holdMs: 9_981.6 }, pub, ctx(pub.goAtMs + 11_000))).toEqual({ holdMs: 9_980 });
    expect(perfectlyHold.validate({ holdMs: 9_985 }, pub, ctx(pub.goAtMs + 11_000))).toEqual({ holdMs: 9_990 });
  });

  it("holds that look the same on screen tie for placement", () => {
    const [a, b] = [10_021, 10_024].map((ms) => (perfectlyHold.validate({ holdMs: ms }, pub, ctx(pub.goAtMs + 11_000)) as { holdMs: number }).holdMs);
    const r = perfectlyHold.score({
      pub,
      secret: null,
      setup,
      submissions: [{ playerId: "a", answer: { holdMs: a }, submittedAtMs: 1 }, { playerId: "b", answer: { holdMs: b }, submittedAtMs: 2 }],
      players,
      allPlayers: players,
      openedAtMs: 0,
      durationMs: 0,
    });
    expect(r.points).toEqual({ a: 100, b: 100 });
  });

  it("rejects junk, taps, holds over the limit and holds longer than the time since GO", () => {
    for (const bad of [null, {}, { holdMs: "10" }, { holdMs: Number.NaN }, { holdMs: Infinity }]) expect(() => perfectlyHold.validate(bad, pub, ctx())).toThrow();
    expect(() => perfectlyHold.validate({ holdMs: 40 }, pub, ctx())).toThrow(/tap/);
    expect(() => perfectlyHold.validate({ holdMs: pub.maxHoldMs + 10 }, pub, ctx())).toThrow();
    // Only 3 s since GO: a 10 s hold must have started before GO.
    expect(() => perfectlyHold.validate({ holdMs: 10_000 }, pub, ctx(pub.goAtMs + 3_000))).toThrow();
    // Clock drift allowance.
    expect(perfectlyHold.validate({ holdMs: 4_000 }, pub, ctx(pub.goAtMs + 3_000))).toEqual({ holdMs: 4_000 });
  });
});

describe("scoring", () => {
  it("ranks by closeness (spec example) and awards 100 / 75 / 50 / 25, 0 without a hold", () => {
    const { setup, pub } = round(10_000);
    const subs = [
      { playerId: "d", answer: { holdMs: 8_000 }, submittedAtMs: 1 },
      { playerId: "b", answer: { holdMs: 10_250 }, submittedAtMs: 2 },
      { playerId: "a", answer: { holdMs: 9_980 }, submittedAtMs: 3 },
      { playerId: "c", answer: { holdMs: 9_500 }, submittedAtMs: 4 },
    ];
    const r = perfectlyHold.score({ pub, secret: null, setup, submissions: subs, players, allPlayers: players, openedAtMs: 0, durationMs: 0 });
    expect(r.points).toEqual({ a: 100, b: 75, c: 50, d: 25 });
    const reveal = r.reveal as HoldReveal;
    expect(reveal.targetMs).toBe(10_000);
    expect(reveal.results.map((x) => [x.playerId, x.diffMs, x.rank])).toEqual([
      ["a", 20, 1],
      ["b", 250, 2],
      ["c", 500, 3],
      ["d", 2_000, 4],
      ["e", null, null],
    ]);
    expect(r.feedback.e.detail).toMatch(/No hold/);
    expect(r.feedback.a.detail).toMatch(/9\.98s/);
    expect((r.setup as HoldSetup).best).toEqual({ a: 20, b: 250, c: 500, d: 2_000 });
  });

  it("gives tied players the same placement points", () => {
    const { setup, pub } = round(10_000);
    const subs = [
      { playerId: "a", answer: { holdMs: 9_900 }, submittedAtMs: 1 },
      { playerId: "b", answer: { holdMs: 10_100 }, submittedAtMs: 2 },
      { playerId: "c", answer: { holdMs: 10_300 }, submittedAtMs: 3 },
    ];
    const r = perfectlyHold.score({ pub, secret: null, setup, submissions: subs, players, allPlayers: players, openedAtMs: 0, durationMs: 0 });
    expect(r.points).toEqual({ a: 100, b: 100, c: 50 });
    expect(rankHolds([{ diffMs: 5 }, { diffMs: 5 }, { diffMs: 5 }, { diffMs: 9 }]).map((h) => h.rank)).toEqual([1, 1, 1, 4]);
  });

  it("keeps each player's best across rounds for the final results", () => {
    const setup: HoldSetup = { targets: [10_000, 10_000], best: { a: 50 } };
    const pub = perfectlyHold.openRound(setup, 2, 0, players).public;
    const r = perfectlyHold.score({ pub, secret: null, setup, submissions: [{ playerId: "a", answer: { holdMs: 10_400 }, submittedAtMs: 1 }], players, allPlayers: players, openedAtMs: 0, durationMs: 0 });
    expect((r.setup as HoldSetup).best.a).toBe(50);
    expect(perfectlyHold.standingDetail!(r.setup as HoldSetup, "a")).toBe("Best: 0.05s off");
    expect(perfectlyHold.standingDetail!(r.setup as HoldSetup, "e")).toBeUndefined();
  });

  it("labels holds the same way on every screen", () => {
    expect([9_950, 10_400, 11_200, 7_000, 13_000].map((ms) => holdVerdict(ms, 10_000))).toEqual(["perfect", "almost", "good", "early", "late"]);
  });
});
