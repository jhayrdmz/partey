import { describe, expect, it } from "vitest";
import { SCRAMBLE_CATEGORIES, SCRAMBLE_DIFFICULTIES, type ScrambleReveal } from "../../../shared/engine";
import { SCRAMBLE_LIMITS, SCRAMBLE_POINTS } from "../../../shared/gameSettings";
import { normalizeWord, scramble, speedBonus, wordScramble, type ScrambleSetup } from "./wordScramble";
import { ALL_SCRAMBLE_WORDS, difficultyOf } from "./scrambleContent";

const players = ["a", "b", "c", "d", "e"].map((id) => ({ playerId: id, nickname: id.toUpperCase(), avatar: "mango" }));
const opts = (o: Record<string, unknown> = {}) => ({ rounds: 10, roundSeconds: 30, difficulty: "mixed", category: "random", hints: true, speedBonus: false, maxPlayers: 24, ...o });

function assertFirestoreSafe(value: unknown, path = "$", inArray = false): void {
  if (value === undefined) throw new Error(`${path} is undefined`);
  if (Array.isArray(value)) {
    if (inArray) throw new Error(`${path} is a nested array`);
    value.forEach((v, i) => assertFirestoreSafe(v, `${path}[${i}]`, true));
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) assertFirestoreSafe(v, `${path}.${k}`, false);
  }
}

describe("word list", () => {
  it("is unique, letters only, and never two anagrams of each other (one answer per scramble)", () => {
    const words = ALL_SCRAMBLE_WORDS.map((w) => w.word);
    expect(new Set(words).size).toBe(words.length);
    for (const w of words) expect(w).toMatch(/^[A-Z]{3,}$/);
    const keys = words.map((w) => [...w].sort().join(""));
    const dupes = words.filter((_, i) => keys.indexOf(keys[i]) !== i);
    expect(dupes).toEqual([]);
  });

  it("sets difficulty by length and has words for every category and difficulty", () => {
    expect([difficultyOf("TIGER"), difficultyOf("PLANET"), difficultyOf("ADVENTURE")]).toEqual(["easy", "medium", "hard"]);
    for (const c of SCRAMBLE_CATEGORIES) {
      for (const d of SCRAMBLE_DIFFICULTIES) {
        expect(ALL_SCRAMBLE_WORDS.filter((w) => w.category === c && w.difficulty === d).length, `${c}/${d}`).toBeGreaterThanOrEqual(6);
      }
    }
  });
});

describe("scrambling", () => {
  it("never shows the word itself, and keeps exactly its letters", () => {
    for (const { word } of ALL_SCRAMBLE_WORDS) {
      for (let i = 0; i < 5; i++) {
        const s = scramble(word);
        expect(s.join("")).not.toBe(word);
        expect([...s].sort().join("")).toBe([...word].sort().join(""));
      }
    }
  });

  it("gives every player the same scramble (it's in the public round data)", () => {
    const { setup } = wordScramble.setup(players, new Set(), opts());
    const r = wordScramble.openRound(setup, 1, 0, players);
    expect(r.public.letters.join("")).not.toBe(r.secret.word);
    expect(JSON.stringify(r.public)).not.toContain(r.secret.word);
    expect(r.public.cooldownMs).toBe(5000);
    expect(r.eligibleIds).toBeUndefined(); // everyone plays
  });
});

describe("answers", () => {
  it("ignore case, whitespace and stray symbols", () => {
    expect(normalizeWord("  tiger ")).toBe("TIGER");
    const { setup } = wordScramble.setup(players, new Set(), opts());
    const r = wordScramble.openRound(setup, 1, 0, players);
    const ctx = { playerId: "a", setup };
    const valid = wordScramble.validate({ guess: `  ${r.secret.word.toLowerCase()} ` }, r.public, ctx);
    expect(wordScramble.check!(valid, r.public, r.secret).correct).toBe(true);
    expect(wordScramble.check!({ guess: "nope" }, r.public, r.secret).correct).toBe(false);
  });

  it("reject empty or oversized guesses", () => {
    const { setup } = wordScramble.setup(players, new Set(), opts());
    const r = wordScramble.openRound(setup, 1, 0, players);
    const ctx = { playerId: "a", setup };
    expect(() => wordScramble.validate({ guess: "   " }, r.public, ctx)).toThrow();
    expect(() => wordScramble.validate({ guess: "!!" }, r.public, ctx)).toThrow();
    expect(() => wordScramble.validate({ guess: "x".repeat(SCRAMBLE_LIMITS.guessMax + 1) }, r.public, ctx)).toThrow();
    expect(() => wordScramble.validate({ guess: "x".repeat(10_000) }, r.public, ctx)).toThrow();
  });

  it("have a 5-second server cooldown", () => {
    expect(wordScramble.attemptCooldownMs).toBe(5000);
  });
});

describe("scoring", () => {
  const roundWith = (o = {}) => {
    const { setup } = wordScramble.setup(players, new Set(), opts(o));
    return { setup, r: wordScramble.openRound(setup, 1, 1000, players) };
  };

  it("awards 100 / 75 / 50 / 25 by server receive order, ties broken consistently", () => {
    const { setup, r } = roundWith();
    // Out of order, with two answers in the same millisecond.
    const subs = [
      { playerId: "d", answer: { guess: "x" }, submittedAtMs: 9000 },
      { playerId: "c", answer: { guess: "x" }, submittedAtMs: 4000 },
      { playerId: "b", answer: { guess: "x" }, submittedAtMs: 4000 },
      { playerId: "e", answer: { guess: "x" }, submittedAtMs: 12000 },
      { playerId: "a", answer: { guess: "x" }, submittedAtMs: 2000 },
    ];
    const scored = wordScramble.score({ pub: r.public, secret: r.secret, setup, submissions: subs, players, allPlayers: players, openedAtMs: 1000, durationMs: r.durationMs });
    const reveal = scored.reveal as ScrambleReveal;
    expect(reveal.solvers.map((s) => s.playerId)).toEqual(["a", "b", "c", "d", "e"]);
    expect(reveal.solvers.map((s) => s.points)).toEqual([100, 75, 50, 25, 25]);
    expect(scored.points).toEqual({ a: 100, b: 75, c: 50, d: 25, e: 25 });
    expect(reveal.word).toBe(r.secret.word);
    expect((scored.setup as ScrambleSetup).solved).toEqual({ a: 1, b: 1, c: 1, d: 1, e: 1 });
  });

  it("gives nobody points when nobody solves it", () => {
    const { setup, r } = roundWith();
    const scored = wordScramble.score({ pub: r.public, secret: r.secret, setup, submissions: [], players, allPlayers: players, openedAtMs: 1000, durationMs: r.durationMs });
    expect(scored.points).toEqual({});
    expect(scored.feedback.a).toEqual({ correct: false, detail: `Time's up! It was ${r.secret.word}` });
  });

  it("adds the optional speed bonus (up to 50, by time left)", () => {
    expect(speedBonus(0, 30000)).toBe(SCRAMBLE_POINTS.speedBonusMax);
    expect(speedBonus(15000, 30000)).toBe(25);
    expect(speedBonus(30000, 30000)).toBe(0);
    const { setup, r } = roundWith({ speedBonus: true });
    const scored = wordScramble.score({
      pub: r.public, secret: r.secret, setup, players, allPlayers: players, openedAtMs: 1000, durationMs: 30000,
      submissions: [{ playerId: "a", answer: { guess: "x" }, submittedAtMs: 1000 + 15000 }],
    });
    expect(scored.points.a).toBe(100 + 25);
  });

  it("counts words solved across rounds for the final results", () => {
    let { setup } = wordScramble.setup(players, new Set(), opts({ rounds: 3 }));
    for (let round = 1; round <= 3; round++) {
      const r = wordScramble.openRound(setup, round, 0, players);
      const subs = round < 3 ? [{ playerId: "a", answer: { guess: "x" }, submittedAtMs: 10 }] : [];
      setup = wordScramble.score({ pub: r.public, secret: r.secret, setup, submissions: subs, players, allPlayers: players, openedAtMs: 0, durationMs: 30000 }).setup as ScrambleSetup;
    }
    expect(wordScramble.standingDetail!(setup, "a")).toBe("2 words solved");
    expect(wordScramble.standingDetail!(setup, "b")).toBe("0 words solved");
  });
});

describe("setup and hints", () => {
  it("respects category, difficulty and rounds, never repeating a word", () => {
    const { setup, rounds, contentIds } = wordScramble.setup(players, new Set(), opts({ rounds: 5, category: "animals", difficulty: "hard" }));
    expect(rounds).toBe(5);
    expect(new Set(contentIds).size).toBe(5);
    expect(setup.words.every((w) => w.category === "animals" && w.difficulty === "hard" && w.word.length >= 9)).toBe(true);
    expect(setup.roundMs).toBe(30000);
  });

  it("reveals the first letter halfway, then the last letter, and nothing when hints are off", () => {
    const { setup } = wordScramble.setup(players, new Set(), opts({ difficulty: "medium" }));
    const r = wordScramble.openRound(setup, 1, 0, players);
    expect(r.eventAtMs).toBe(15000);
    const one = wordScramble.roundEvent!({ pub: r.public, secret: r.secret, setup, dueAtMs: 15000 });
    expect(one.pub.hints).toEqual([{ index: 0, letter: r.secret.word[0] }]);
    expect(one.nextAtMs).toBe(22500);
    const two = wordScramble.roundEvent!({ pub: one.pub, secret: r.secret, setup, dueAtMs: 22500 });
    expect(two.pub.hints[1]).toEqual({ index: r.secret.word.length - 1, letter: r.secret.word.at(-1) });
    expect(two.nextAtMs).toBeNull();
    const off = wordScramble.setup(players, new Set(), opts({ hints: false }));
    expect(wordScramble.openRound(off.setup, 1, 0, players).eventAtMs).toBeNull();
  });

  it("produces Firestore-safe payloads", () => {
    const { setup } = wordScramble.setup(players, new Set(), opts());
    assertFirestoreSafe(setup);
    const r = wordScramble.openRound(setup, 1, 0, players);
    assertFirestoreSafe(r);
    assertFirestoreSafe(wordScramble.score({ pub: r.public, secret: r.secret, setup, players, allPlayers: players, openedAtMs: 0, durationMs: 30000, submissions: [{ playerId: "a", answer: { guess: "x" }, submittedAtMs: 5 }] }));
  });
});
