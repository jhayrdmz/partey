import { describe, expect, it } from "vitest";
import { speedQuiz, speedQuizPoints } from "./speedQuiz";
import { majority, majorityIndexes, MAJORITY_POINTS } from "./majority";
import { reflex, REFLEX_OTHER_POINTS, REFLEX_RANK_POINTS } from "./reflex";
import { QUIZ } from "./speedQuizContent";
import { MAJORITY } from "./majorityContent";
import { placementPoints, ranks, standingsFrom } from "../engine/lifecycle";

const players = ["a", "b", "c", "d"].map((id) => ({ playerId: id, nickname: id.toUpperCase(), avatar: "mango" }));

/** Firestore rejects nested arrays and undefined values; every payload we persist must avoid them. */
function assertFirestoreSafe(value: unknown, path = "$", inArray = false): void {
  if (value === undefined) throw new Error(`${path} is undefined`);
  if (Array.isArray(value)) {
    if (inArray) throw new Error(`${path} is a nested array`);
    value.forEach((v, i) => assertFirestoreSafe(v, `${path}[${i}]`, true));
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) assertFirestoreSafe(v, `${path}.${k}`, false);
  }
}

describe("payloads are Firestore-safe", () => {
  const subs = (answer: unknown) => players.map((p, i) => ({ playerId: p.playerId, answer, submittedAtMs: 3000 + i * 100 }));
  it.each([
    ["speed-quiz", speedQuiz, { choice: 0 }],
    ["majority", majority, { choice: 1 }],
    ["reflex", reflex, { tap: true }],
  ] as const)("%s", (_name, handler, answer) => {
    const h = handler as unknown as typeof speedQuiz;
    const { setup } = h.setup(players, new Set());
    assertFirestoreSafe(setup);
    const r = h.openRound(setup, 1, 1000);
    assertFirestoreSafe(r.public);
    assertFirestoreSafe(r.secret);
    const scored = h.score({ pub: r.public, secret: r.secret, players, submissions: subs(answer), openedAtMs: 1000, durationMs: r.durationMs });
    assertFirestoreSafe(scored);
  });
});

describe("content", () => {
  it("has unique ids and valid answers", () => {
    expect(new Set(QUIZ.map((q) => q.id)).size).toBe(QUIZ.length);
    expect(new Set(MAJORITY.map((q) => q.id)).size).toBe(MAJORITY.length);
    for (const q of QUIZ) expect(q.options[q.answer]).toBeTruthy();
    for (const q of MAJORITY) expect(q.options.length).toBeGreaterThanOrEqual(2);
  });
});

describe("speed quiz", () => {
  it("awards 1000 for an instant answer and 500 at the buzzer", () => {
    expect(speedQuizPoints(0, 15000)).toBe(1000);
    expect(speedQuizPoints(15000, 15000)).toBe(500);
    expect(speedQuizPoints(7500, 15000)).toBe(750);
  });

  it("shuffles options but keeps the correct answer, never exposing it publicly", () => {
    const { setup, rounds } = speedQuiz.setup(players, new Set());
    expect(rounds).toBe(8);
    const r = speedQuiz.openRound(setup, 1, 0);
    const item = setup.items[0].item;
    expect(r.public.options[r.secret.correctIndex]).toBe(item.options[item.answer]);
    expect(JSON.stringify(r.public)).not.toContain("correct");
  });

  it("prefers unused questions", () => {
    const used = new Set(QUIZ.slice(0, QUIZ.length - 8).map((q) => q.id));
    const { contentIds } = speedQuiz.setup(players, used);
    for (const id of contentIds) expect(used.has(id)).toBe(false);
  });

  it("scores only correct answers, fastest first", () => {
    const { setup } = speedQuiz.setup(players, new Set());
    const r = speedQuiz.openRound(setup, 1, 1000);
    const wrong = (r.secret.correctIndex + 1) % 4;
    const result = speedQuiz.score({
      pub: r.public, secret: r.secret, players, openedAtMs: 1000, durationMs: 15000,
      submissions: [
        { playerId: "a", answer: { choice: r.secret.correctIndex }, submittedAtMs: 4000 },
        { playerId: "b", answer: { choice: r.secret.correctIndex }, submittedAtMs: 2000 },
        { playerId: "c", answer: { choice: wrong }, submittedAtMs: 1500 },
      ],
    });
    expect(result.points.b).toBeGreaterThan(result.points.a);
    expect(result.points.c).toBe(0);
    expect(result.feedback.d.detail).toBe("No answer");
    expect((result.reveal as { fastest: { playerId: string }[] }).fastest.map((f) => f.playerId)).toEqual(["b", "a"]);
  });

  it("rejects out-of-range choices", () => {
    expect(() => speedQuiz.validate({ choice: 4 }, { prompt: "", options: ["a", "b", "c", "d"] })).toThrow();
    expect(() => speedQuiz.validate({ choice: 1.5 }, { prompt: "", options: ["a", "b", "c", "d"] })).toThrow();
    expect(speedQuiz.validate({ choice: 3, extra: "x" }, { prompt: "", options: ["a", "b", "c", "d"] })).toEqual({ choice: 3 });
  });
});

describe("guess the majority", () => {
  it("finds the majority, including ties, and nothing when nobody answered", () => {
    expect(majorityIndexes([3, 1, 0])).toEqual([0]);
    expect(majorityIndexes([2, 2, 1])).toEqual([0, 1]);
    expect(majorityIndexes([0, 0])).toEqual([]);
  });

  it("rewards everyone who picked with the crowd", () => {
    const pub = { prompt: "?", options: ["x", "y", "z"] };
    const result = majority.score({
      pub, secret: null, players, openedAtMs: 0, durationMs: 1,
      submissions: [
        { playerId: "a", answer: { choice: 0 }, submittedAtMs: 1 },
        { playerId: "b", answer: { choice: 0 }, submittedAtMs: 1 },
        { playerId: "c", answer: { choice: 2 }, submittedAtMs: 1 },
      ],
    });
    expect(result.points).toEqual({ a: MAJORITY_POINTS, b: MAJORITY_POINTS, c: 0 });
  });
});

describe("reflex battle", () => {
  it("ranks valid taps and zeroes false starts", () => {
    const pub = { goAtMs: 10_000 };
    const result = reflex.score({
      pub, secret: null, players, openedAtMs: 0, durationMs: 1,
      submissions: [
        { playerId: "a", answer: { tap: true }, submittedAtMs: 10_350 },
        { playerId: "b", answer: { tap: true }, submittedAtMs: 10_200 },
        { playerId: "c", answer: { tap: true }, submittedAtMs: 9_900 },
      ],
    });
    expect(result.points.b).toBe(REFLEX_RANK_POINTS[0]);
    expect(result.points.a).toBe(REFLEX_RANK_POINTS[1]);
    expect(result.points.c).toBeUndefined();
    expect(result.feedback.c.detail).toMatch(/False start/);
    expect(REFLEX_OTHER_POINTS).toBeLessThan(REFLEX_RANK_POINTS[2]);
  });

  it("puts GO 2–6 s after the round opens and shifts it on resume", () => {
    const r = reflex.openRound({ rounds: 5 }, 1, 1000);
    expect(r.public.goAtMs - 1000).toBeGreaterThanOrEqual(2000);
    expect(r.public.goAtMs - 1000).toBeLessThanOrEqual(6000);
    expect(reflex.shiftTimes!(r.public, null, 500).pub.goAtMs).toBe(r.public.goAtMs + 500);
  });
});

describe("standings and tournament placement", () => {
  it("shares ranks and placement points on ties", () => {
    const standings = standingsFrom({ a: 900, b: 900, c: 400, d: 0 }, players);
    expect([...ranks(standings).entries()]).toEqual([["a", 1], ["b", 1], ["c", 3], ["d", 4]]);
    const pts = placementPoints(standings, { placementPoints: [100, 60, 30], otherPoints: 10 });
    expect(Object.fromEntries(pts)).toEqual({ a: 100, b: 100, c: 30, d: 10 });
  });
});
