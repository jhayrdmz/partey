import { describe, expect, it } from "vitest";
import type { AuthorGuessRound, AuthorReveal } from "../../../shared/engine";
import { authorBonus } from "../../../shared/gameSettings";
import type { EngineSubmission } from "../engine/types";
import { AUTHOR_PROMPT_LIST, AUTHOR_PROMPTS } from "./authorContent";
import { pickPrompts, theAuthor, type AuthorSetup } from "./theAuthor";

const players = ["ana", "ben", "cy", "dee"].map((id) => ({ playerId: id, nickname: id[0].toUpperCase() + id.slice(1), avatar: "mango" }));
const settings = { rounds: 2, category: "funny", writeSeconds: 60, guessSeconds: 20, maxPlayers: 16 } as const;
const sub = (playerId: string, answer: unknown): EngineSubmission => ({ playerId, answer, submittedAtMs: 0 });

/** Plays a round through the handler like the engine does: open (may replace setup), then score. */
function play(setup: AuthorSetup, round: number, submissions: (open: ReturnType<typeof theAuthor.openRound>) => EngineSubmission[]) {
  const opened = theAuthor.openRound(setup, round, 0, players);
  const s = (opened.setup as AuthorSetup | undefined) ?? setup;
  const eligible = players.filter((p) => (opened.eligibleIds ?? players.map((x) => x.playerId)).includes(p.playerId));
  const scored = theAuthor.score({ pub: opened.public, secret: opened.secret, setup: s, submissions: submissions(opened), players: eligible, allPlayers: players, openedAtMs: 0, durationMs: opened.durationMs });
  return { opened, scored, setup: scored.setup as AuthorSetup };
}

describe("prompts", () => {
  it("has 15 questions per category with unique ids", () => {
    for (const list of Object.values(AUTHOR_PROMPTS)) expect(list).toHaveLength(15);
    expect(new Set(AUTHOR_PROMPT_LIST.map((p) => p.id)).size).toBe(AUTHOR_PROMPT_LIST.length);
  });
  it("picks from one category, or spreads random over categories, never repeating", () => {
    expect(pickPrompts(5, "deep", new Set()).every((p) => p.category === "deep")).toBe(true);
    const random = pickPrompts(6, "random", new Set());
    expect(new Set(random.map((p) => p.category)).size).toBe(6);
    const many = pickPrompts(15, "childhood", new Set());
    expect(new Set(many.map((p) => p.id)).size).toBe(15);
  });
  it("prefers questions not played in this room yet", () => {
    const used = new Set(AUTHOR_PROMPT_LIST.filter((p) => p.category === "funny").slice(0, 13).map((p) => p.id));
    expect(pickPrompts(2, "funny", used).every((p) => !used.has(p.id))).toBe(true);
  });
});

describe("a game", () => {
  it("writes, then guesses each answer anonymously, scoring streaks, then ends with awards", () => {
    const start = theAuthor.setup(players, new Set(), settings);
    expect(start.setup.prompts).toHaveLength(2);
    expect(start.rounds).toBe(10); // estimate: 2 × (1 write + 4 answers)

    // Q1 write: Ana, Ben and Cy answer; Dee doesn't.
    const w1 = play(start.setup, 1, () => [sub("ana", { text: "Ana's answer" }), sub("ben", { text: "Ben's answer" }), sub("cy", { text: "Cy's answer" })]);
    expect(w1.opened.public.kind).toBe("write");
    expect(w1.opened.label).toBe("Question 1 of 2");
    expect(w1.scored.reveal).toEqual({ kind: "collected", prompt: start.setup.prompts[0].text, count: 3, awards: null });
    // Planned: write, 3 guesses, next write; Q2 still estimated.
    expect(w1.setup.steps.map((s) => s.kind)).toEqual(["write", "guess", "guess", "guess", "write"]);
    expect(w1.scored.totalRounds).toBe(5);
    expect(new Set(w1.setup.entries.map((e) => e.card)).size).toBe(3);

    // Guess the 3 answers. Dee always right; Ana right, then wrong; nobody can guess themselves.
    let setup = w1.setup;
    const authors: string[] = [];
    for (let r = 2; r <= 4; r++) {
      const g = play(setup, r, (open) => {
        const pub = open.public as AuthorGuessRound;
        const author = (open.secret as { author: string }).author;
        authors.push(author);
        // Anonymous: the public round never names the author, and the author can't guess.
        expect(JSON.stringify(pub)).not.toContain(`"author"`);
        expect(open.eligibleIds).not.toContain(author);
        expect(open.privateFor).toEqual({ [author]: { yourAnswer: true } });
        expect(pub.candidates.map((c) => c.nickname)).toEqual(["Ana", "Ben", "Cy"]);
        const subs = [sub("dee", { author })];
        if (author !== "ana") subs.push(sub("ana", { author: r === 2 || (r === 3 && authors[0] === "ana") ? author : author === "ben" ? "cy" : "ben" }));
        return subs;
      });
      setup = g.setup;
      const rev = g.scored.reveal as AuthorReveal & { kind: "author" };
      expect(rev.author.playerId).toBe(authors.at(-1));
      const dee = rev.results.find((x) => x.playerId === "dee")!;
      expect([dee.correct, dee.streak, dee.base, dee.bonus]).toEqual([true, r - 1, 100, authorBonus(r - 1)]);
      expect(g.scored.points.dee).toBe(100 + 50 * (r - 2));
      expect(rev.awards).toBeNull();
    }
    expect(setup.streak.dee).toBe(3);
    expect(setup.correct.dee).toBe(3);
    expect(setup.bonus.dee).toBe(150);

    // Q2 write: nobody answers → the game ends right here, with awards.
    const w2 = play(setup, 5, () => []);
    expect(w2.scored.totalRounds).toBe(5);
    const end = w2.scored.reveal as AuthorReveal & { kind: "collected" };
    expect(end.count).toBe(0);
    expect(end.awards?.bestDetective).toEqual({ players: [players[3]], correct: 3 });
    expect(end.awards?.longestStreak).toEqual({ players: [players[3]], streak: 3 });
    // Every answer was found by Dee (and Ana found the first): the top count, and everyone tied, win.
    expect(end.awards?.mostObvious?.found).toBeGreaterThanOrEqual(1);
    expect(w2.scored.revealMs).toBe(20_000);
    expect(theAuthor.standingDetail!(w2.setup, "dee")).toBe("3 found · 300 + 150 bonus · streak 3");
  });

  it("validates answers and guesses", () => {
    const start = theAuthor.setup(players, new Set(), settings).setup;
    const write = theAuthor.openRound(start, 1, 0, players).public;
    const ctx = { playerId: "ana", setup: start };
    expect(theAuthor.validate({ text: "  my   answer " }, write, ctx)).toEqual({ text: "my answer" });
    expect(() => theAuthor.validate({ text: "   " }, write, ctx)).toThrow(/Write an answer/);
    expect(() => theAuthor.validate({ text: "x".repeat(121) }, write, ctx)).toThrow(/under 120/);
    expect(() => theAuthor.validate({ author: "ben" }, write, ctx)).toThrow(/Write an answer/);

    const w = play(start, 1, () => [sub("ana", { text: "a" }), sub("ben", { text: "b" })]);
    const guess = theAuthor.openRound(w.setup, 2, 0, players).public;
    expect(theAuthor.validate({ author: "ben" }, guess, ctx)).toEqual({ author: "ben" });
    expect(() => theAuthor.validate({ author: "ana" }, guess, ctx)).toThrow(/can't pick yourself/);
    expect(() => theAuthor.validate({ author: "dee" }, guess, ctx)).toThrow(/from the list/);
    expect(() => theAuthor.validate({ text: "hi" }, guess, ctx)).toThrow(/from the list/);
  });

  it("reveals the most-guessed player (and ties), resets missed guesses, and ends on the last answer", () => {
    const one = { ...settings, rounds: 1 };
    const start = theAuthor.setup(players, new Set(), one).setup;
    const w = play(start, 1, () => [sub("ana", { text: "only Ana wrote" }), sub("ben", { text: "Ben too" })]);
    expect(w.scored.totalRounds).toBe(3);
    let setup = w.setup;
    for (let r = 2; r <= 3; r++) {
      const g = play(setup, r, (open) => {
        const author = (open.secret as { author: string }).author;
        const other = author === "ana" ? "ben" : "ana";
        // Cy and Dee both pick the wrong one; the other writer doesn't guess.
        return [sub("cy", { author: other }), sub("dee", { author: other })];
      });
      setup = g.setup;
      const rev = g.scored.reveal as AuthorReveal & { kind: "author" };
      expect(rev.mostGuessed?.votes).toBe(2);
      expect(rev.mostGuessed?.tied).toBe(false);
      expect(rev.correctCount).toBe(0);
      const silent = rev.results.find((x) => x.guess === null)!;
      expect([silent.correct, silent.streak, silent.points]).toEqual([false, 0, 0]);
      expect(rev.awards === null).toBe(r < 3);
    }
    const awards = (play(setup, 3, () => []).scored.reveal as AuthorReveal & { kind: "author" }).awards!;
    // Nobody found anyone: no detective, no obvious answer, no streak.
    expect(awards).toEqual({ bestDetective: null, mostObvious: null, longestStreak: null });
  });

  it("ties share an award", () => {
    const start = theAuthor.setup(players, new Set(), { ...settings, rounds: 1 }).setup;
    const w = play(start, 1, () => [sub("ana", { text: "a" }), sub("ben", { text: "b" })]);
    let setup = w.setup;
    for (let r = 2; r <= 2; r++) {
      // Cy and Dee both find every author: tied on correct guesses and streaks; both answers found by 2.
      setup = play(setup, r, (open) => {
        const author = (open.secret as { author: string }).author;
        return [sub("cy", { author }), sub("dee", { author })];
      }).setup;
    }
    const a = (play(setup, 3, (open) => {
      const author = (open.secret as { author: string }).author;
      return [sub("cy", { author }), sub("dee", { author })];
    }).scored.reveal as AuthorReveal & { kind: "author" }).awards!;
    expect(a.bestDetective).toEqual({ players: [players[2], players[3]], correct: 2 });
    expect(a.longestStreak).toEqual({ players: [players[2], players[3]], streak: 2 });
    expect(a.mostObvious?.found).toBe(2);
    expect(a.mostObvious?.answers.map((x) => x.author.nickname)).toEqual(["Ana", "Ben"]);
  });
});
