import { describe, expect, it } from "vitest";
import type { RushReveal } from "../../../shared/engine";
import { RUSH_LIMITS, rushAllowed, rushMultiplier, rushPoints } from "../../../shared/gameSettings";
import { numberRush, pickNumbers, type RushSetup } from "./numberRush";

const players = ["a", "b", "c", "d"].map((id) => ({ playerId: id, nickname: id.toUpperCase(), avatar: "mango" }));
const setupWith = (numbers: number[], extra: Partial<RushSetup> = {}): RushSetup => ({ numbers, streak: {}, best: {}, totals: {}, roundMs: 10_000, ...extra });

describe("numbers", () => {
  it("are three digits and never repeat back to back", () => {
    const n = pickNumbers(2000);
    expect(n).toHaveLength(2000);
    expect(n.every((x) => Number.isInteger(x) && x >= 100 && x <= 999)).toBe(true);
    for (let i = 1; i < n.length; i++) expect(n[i]).not.toBe(n[i - 1]);
  });

  it("setup draws rounds + 1 numbers and uses the host's time", () => {
    const s = numberRush.setup(players, new Set(), { rounds: 7, seconds: 5, maxPlayers: 24 });
    expect(s.rounds).toBe(7);
    expect(s.setup.numbers).toHaveLength(8);
    expect(s.setup.roundMs).toBe(5_000);
    expect(numberRush.setup(players, new Set()).rounds).toBe(RUSH_LIMITS.rounds.default);
  });
});

describe("rounds", () => {
  it("publish only the current number; the next stays secret", () => {
    const opened = numberRush.openRound(setupWith([500, 720, 130], { streak: { a: 2, b: 0, c: 4 } }), 2, 0, players);
    expect(opened.public).toEqual({
      current: 720,
      onStreak: [
        { playerId: "c", nickname: "C", avatar: "mango", streak: 4 },
        { playerId: "a", nickname: "A", avatar: "mango", streak: 2 },
      ],
    });
    expect(opened.secret).toEqual({ next: 130 });
    expect(opened.durationMs).toBe(10_000);
    expect(JSON.stringify(opened.public)).not.toContain("130");
  });
});

describe("validation", () => {
  const ctx = { playerId: "a", setup: setupWith([500, 600]) };
  it("accepts higher / lower", () => {
    expect(numberRush.validate({ choice: "higher" }, { current: 500, onStreak: [] }, ctx)).toEqual({ choice: "higher" });
    expect(numberRush.validate({ choice: "lower" }, { current: 500, onStreak: [] }, ctx)).toEqual({ choice: "lower" });
  });
  it("refuses junk and impossible picks at 999 and 100", () => {
    for (const bad of [{ choice: "up" }, { choice: 1 }, {}, null]) expect(() => numberRush.validate(bad, { current: 500, onStreak: [] }, ctx)).toThrow(/HIGHER or LOWER/);
    expect(() => numberRush.validate({ choice: "higher" }, { current: 999, onStreak: [] }, ctx)).toThrow(/Nothing is higher than 999/);
    expect(() => numberRush.validate({ choice: "lower" }, { current: 100, onStreak: [] }, ctx)).toThrow(/Nothing is lower than 100/);
    expect(rushAllowed(999)).toEqual({ higher: false, lower: true });
    expect(rushAllowed(100)).toEqual({ higher: true, lower: false });
  });
});

describe("scoring", () => {
  it("multipliers: 10, 13, 13, 15, 15, 20, 20", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 12].map(rushPoints)).toEqual([10, 13, 13, 15, 15, 20, 20, 20]);
    expect([0, 1, 2, 3, 4, 5, 6].map(rushMultiplier)).toEqual([0, 1, 1.25, 1.25, 1.5, 1.5, 2]);
  });

  it("scores by streak, resets wrong and missed, keeps totals and best streaks", () => {
    const setup = setupWith([400, 800], { streak: { a: 5, b: 1, c: 3 }, best: { c: 3 }, totals: { a: 60, b: 10, c: 36 } });
    const sub = (playerId: string, choice: string) => ({ playerId, answer: { choice }, submittedAtMs: 0 });
    const scored = numberRush.score({
      pub: { current: 400, onStreak: [] },
      secret: { next: 800 },
      setup,
      submissions: [sub("a", "higher"), sub("b", "higher"), sub("c", "lower")],
      players,
      allPlayers: players,
      openedAtMs: 0,
      durationMs: 10_000,
    });
    // a: 6th in a row → 2x = 20; b: 2nd → 13; c wrong → 0, streak reset; d missed → 0.
    expect(scored.points).toEqual({ a: 20, b: 13, c: 0, d: 0 });
    const r = scored.reveal as RushReveal;
    expect([r.previous, r.next, r.direction]).toEqual([400, 800, "higher"]);
    expect(r.results.map((x) => [x.playerId, x.choice, x.correct, x.streak, x.multiplier, x.points, x.total])).toEqual([
      ["a", "higher", true, 6, 2, 20, 80],
      ["b", "higher", true, 2, 1.25, 13, 23],
      ["c", "lower", false, 0, 0, 0, 36],
      ["d", null, false, 0, 0, 0, 0],
    ]);
    const next = scored.setup as RushSetup;
    expect(next.streak).toEqual({ a: 6, b: 2, c: 0, d: 0 });
    expect(next.best).toEqual({ a: 6, b: 2, c: 3, d: 0 });
    expect(scored.feedback.a.detail).toBe("6 in a row · 2x");
    expect(scored.feedback.c.detail).toBe("It went higher");
    expect(scored.feedback.d.detail).toBe("No prediction this round");
    expect(numberRush.standingDetail!(next, "c")).toBe("Best streak: 3");
  });

  it("lower wins when the number drops", () => {
    const scored = numberRush.score({
      pub: { current: 999, onStreak: [] },
      secret: { next: 100 },
      setup: setupWith([999, 100]),
      submissions: [{ playerId: "a", answer: { choice: "lower" }, submittedAtMs: 0 }],
      players,
      allPlayers: players,
      openedAtMs: 0,
      durationMs: 10_000,
    });
    expect((scored.reveal as RushReveal).direction).toBe("lower");
    expect(scored.points.a).toBe(10);
  });
});
