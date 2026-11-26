import { describe, expect, it } from "vitest";
import { DRAW_CATEGORIES, type DrawReveal, type DrawSecret } from "../../../shared/engine";
import { DRAW_POINTS, chooseArtist, drawing, guessPoints, judgeGuess, maxHints, normalizeGuess, promptLetters, type DrawingSetup } from "./drawing";
import { ALL_DRAW_PROMPTS } from "./drawingContent";

const players = ["a", "b", "c", "d"].map((id) => ({ playerId: id, nickname: id.toUpperCase(), avatar: "mango" }));

function assertFirestoreSafe(value: unknown, path = "$", inArray = false): void {
  if (value === undefined) throw new Error(`${path} is undefined`);
  if (Array.isArray(value)) {
    if (inArray) throw new Error(`${path} is a nested array`);
    value.forEach((v, i) => assertFirestoreSafe(v, `${path}[${i}]`, true));
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) assertFirestoreSafe(v, `${path}.${k}`, false);
  }
}

describe("prompts", () => {
  it("cover every category with unique ids", () => {
    expect(new Set(ALL_DRAW_PROMPTS.map((p) => p.id)).size).toBe(ALL_DRAW_PROMPTS.length);
    for (const c of DRAW_CATEGORIES) expect(ALL_DRAW_PROMPTS.filter((p) => p.category === c).length).toBeGreaterThanOrEqual(20);
  });
});

describe("guess matching", () => {
  it("ignores case, accents, spacing, punctuation, articles and plurals", () => {
    const answers = ["Ice cream", "Halo-halo"].map(normalizeGuess);
    expect(judgeGuess("ICE CREAM", answers).correct).toBe(true);
    expect(judgeGuess("icecream", answers).correct).toBe(true);
    expect(judgeGuess("an ice cream!", answers).correct).toBe(true);
    expect(judgeGuess("ice creams", answers).correct).toBe(true);
    expect(judgeGuess("halo halo", answers).correct).toBe(true);
    expect(judgeGuess("Hálo-hálo", answers).correct).toBe(true);
  });

  it("accepts aliases and flags near misses without accepting them", () => {
    const answers = ["Hamburger", "Burger"].map(normalizeGuess);
    expect(judgeGuess("burger", answers).correct).toBe(true);
    expect(judgeGuess("hamburgr", answers)).toEqual({ correct: false, close: true });
    expect(judgeGuess("pizza", answers)).toEqual({ correct: false, close: false });
    // Short words never get "so close" (it'd give the answer away).
    expect(judgeGuess("bat", [normalizeGuess("Cat")]).close).toBe(false);
  });
});

describe("scoring", () => {
  it("awards 100/80/60/40 then 20 by order, plus the artist bonus", () => {
    expect([0, 1, 2, 3, 4, 9].map(guessPoints)).toEqual([100, 80, 60, 40, 20, 20]);
    const many = ["a", "b", "c", "d", "e", "f"].map((id) => ({ playerId: id, nickname: id, avatar: "mango" }));
    const { setup } = drawing.setup(many, new Set());
    const r = drawing.openRound(setup, 1, 1000, many);
    const artist = r.public.artist.playerId;
    const guessers = many.filter((p) => p.playerId !== artist);
    // Submitted out of order: scoring goes by time.
    const subs = guessers.map((p, i) => ({ playerId: p.playerId, answer: { guess: "x" }, submittedAtMs: 5000 - i * 500 }));
    const scored = drawing.score({ pub: r.public, secret: r.secret, setup, submissions: subs, players: guessers, allPlayers: many, openedAtMs: 1000, durationMs: r.durationMs });
    const reveal = scored.reveal as DrawReveal;
    expect(reveal.guessers.map((g) => g.playerId)).toEqual([...guessers].reverse().map((p) => p.playerId));
    expect(reveal.guessers.map((g) => g.points)).toEqual([100, 80, 60, 40, 20]);
    expect(scored.points[artist]).toBe(DRAW_POINTS.artistBonus);
    expect(reveal.artistPoints).toBe(50);
    expect(scored.feedback[artist].correct).toBe(true);
  });

  it("gives the artist nothing when nobody guesses", () => {
    const { setup } = drawing.setup(players, new Set());
    const r = drawing.openRound(setup, 1, 1000, players);
    const guessers = players.filter((p) => p.playerId !== r.public.artist.playerId);
    const scored = drawing.score({ pub: r.public, secret: r.secret, setup, submissions: [], players: guessers, allPlayers: players, openedAtMs: 1000, durationMs: r.durationMs });
    expect(scored.points[r.public.artist.playerId]).toBe(0);
    for (const g of guessers) expect(scored.feedback[g.playerId]).toEqual({ correct: false, detail: `It was “${r.secret.word}”` });
  });
});

describe("rounds", () => {
  it("keeps the prompt out of public data and gives it to the artist only", () => {
    const { setup, rounds } = drawing.setup(players, new Set());
    expect(rounds).toBe(6);
    const r = drawing.openRound(setup, 1, 0, players);
    expect(JSON.stringify(r.public).toLowerCase()).not.toContain(r.secret.word.toLowerCase());
    expect(r.eligibleIds).not.toContain(r.public.artist.playerId);
    expect(r.eligibleIds).toHaveLength(3);
    const secrets = r.privateFor as Record<string, DrawSecret>;
    expect(secrets[r.public.artist.playerId]).toEqual({ role: "artist", word: r.secret.word, category: r.public.category });
    for (const p of players.filter((p) => p.playerId !== r.public.artist.playerId)) expect(secrets[p.playerId]).toEqual({ role: "guesser" });
    expect(r.public.hint.reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
  });

  it("rotates artists: everyone draws before anyone draws twice, never twice in a row", () => {
    let { setup } = drawing.setup(players, new Set(), { rounds: 12, drawSeconds: 60, categories: ["animals"], maxPlayers: 12 });
    const artists: string[] = [];
    for (let round = 1; round <= 12; round++) {
      const r = drawing.openRound(setup, round, 0, players);
      artists.push(r.public.artist.playerId);
      setup = r.setup as DrawingSetup;
    }
    for (let i = 0; i < 12; i += 4) expect(new Set(artists.slice(i, i + 4)).size).toBe(4);
    for (let i = 1; i < 12; i++) expect(artists[i]).not.toBe(artists[i - 1]);
  });

  it("only picks artists still in the room", () => {
    const { setup } = drawing.setup(players, new Set());
    const present = players.slice(0, 2);
    for (let i = 0; i < 20; i++) expect(present.map((p) => p.playerId)).toContain(chooseArtist(setup, present).playerId);
  });

  it("never repeats a prompt, prefers unused ones, and respects categories", () => {
    const sports = ALL_DRAW_PROMPTS.filter((p) => p.category === "sports");
    const used = new Set(sports.slice(0, sports.length - 3).map((p) => p.id));
    const { setup, contentIds } = drawing.setup(players, used, { rounds: 3, drawSeconds: 45, categories: ["sports"], maxPlayers: 12 });
    expect(setup.drawMs).toBe(45_000);
    expect(new Set(contentIds).size).toBe(3);
    for (const id of contentIds) expect(used.has(id)).toBe(false);
    expect(setup.prompts.every((p) => p.category === "sports")).toBe(true);
  });

  it("validates guesses", () => {
    const { setup } = drawing.setup(players, new Set());
    const r = drawing.openRound(setup, 1, 0, players);
    const ctx = { playerId: "a", setup };
    expect(drawing.validate({ guess: "  big   cat " }, r.public, ctx)).toEqual({ guess: "big cat" });
    expect(() => drawing.validate({ guess: "   " }, r.public, ctx)).toThrow();
    expect(() => drawing.validate({ guess: "x".repeat(41) }, r.public, ctx)).toThrow();
    expect(() => drawing.validate({}, r.public, ctx)).toThrow();
    expect(drawing.check!({ guess: r.secret.word.toUpperCase() }, r.public, r.secret).correct).toBe(true);
  });

  it("produces Firestore-safe payloads", () => {
    const { setup } = drawing.setup(players, new Set());
    assertFirestoreSafe(setup);
    const r = drawing.openRound(setup, 1, 1000, players);
    assertFirestoreSafe(r);
    const guessers = players.filter((p) => p.playerId !== r.public.artist.playerId);
    const subs = guessers.map((p, i) => ({ playerId: p.playerId, answer: { guess: r.secret.word }, submittedAtMs: 2000 + i }));
    assertFirestoreSafe(drawing.score({ pub: r.public, secret: r.secret, setup, submissions: subs, players: guessers, allPlayers: players, openedAtMs: 1000, durationMs: r.durationMs }));
  });
});

describe("letter hints", () => {
  const opts = (hintSeconds: number) => ({ rounds: 3, drawSeconds: 80, hintSeconds, categories: ["food"], maxPlayers: 12 });

  it("caps hints at a third of the letters (never half)", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 9, 12].map(maxHints)).toEqual([0, 1, 1, 2, 2, 2, 3, 3, 4]);
    expect(promptLetters("Ice cream!")).toEqual(["I", "c", "e", "c", "r", "e", "a", "m"]);
  });

  it("starts with no letters and schedules the first hint after the interval", () => {
    const { setup } = drawing.setup(players, new Set(), opts(15));
    const r = drawing.openRound(setup, 1, 1000, players);
    expect(r.public.revealed).toEqual([]);
    expect(r.eventAtMs).toBe(16_000);
    expect(r.secret.hintOrder).toHaveLength(maxHints(promptLetters(r.secret.word).length));
  });

  it("reveals one new letter per event, matching the prompt, then stops", () => {
    const { setup } = drawing.setup(players, new Set(), opts(10));
    const r = drawing.openRound(setup, 1, 0, players);
    const letters = promptLetters(r.secret.word);
    let pub = r.public;
    let due = r.eventAtMs!;
    const max = maxHints(letters.length);
    for (let k = 1; k <= max; k++) {
      const out = drawing.roundEvent!({ pub, secret: r.secret, setup, dueAtMs: due });
      pub = out.pub;
      expect(pub.revealed).toHaveLength(k);
      for (const h of pub.revealed) expect(h.letter).toBe(letters[h.index]);
      expect(new Set(pub.revealed.map((h) => h.index)).size).toBe(k);
      if (k < max) {
        expect(out.nextAtMs).toBe(due + 10_000);
        due = out.nextAtMs!;
      } else expect(out.nextAtMs).toBeNull();
    }
    expect(pub.revealed.length).toBeLessThan(letters.length);
    assertFirestoreSafe(pub);
  });

  it("are off when the host turns them off", () => {
    const { setup } = drawing.setup(players, new Set(), opts(0));
    const r = drawing.openRound(setup, 1, 0, players);
    expect(r.eventAtMs).toBeNull();
    expect(r.secret.hintOrder).toEqual([]);
  });
});
