import type { AuthorAwards, AuthorCategory, AuthorGuessResult, AuthorReveal, AuthorRound, PlayerPick } from "../../../shared/engine";
import { AUTHOR_CATEGORIES, AUTHOR_LIMITS, AUTHOR_POINTS, authorBonus, authorSettings } from "../../../shared/gameSettings";
import { fail } from "../lib/errors";
import { capRaw, cleanText } from "../lib/validate";
import type { GameHandler, ScoredRound } from "../engine/types";
import { pickFresh, shuffle } from "../engine/random";
import { AUTHOR_PROMPT_LIST, type AuthorPrompt } from "./authorContent";

/** One written answer (server-only until its reveal). */
interface AuthorEntry {
  question: number;
  author: PlayerPick;
  text: string;
  card: number;
  /** Filled in at its reveal. */
  found?: number;
  guessers?: number;
}

type Step = { kind: "write"; question: number } | { kind: "guess"; question: number; entry: number };

export interface AuthorSetup {
  prompts: AuthorPrompt[];
  /** The game's steps so far: each question's write step, then one guess step per answer it got. */
  steps: Step[];
  entries: AuthorEntry[];
  writeMs: number;
  guessMs: number;
  streak: Record<string, number>;
  best: Record<string, number>;
  correct: Record<string, number>;
  bonus: Record<string, number>;
  /** Index in `steps` of the round being played (set when it opens). */
  current: number;
}

const pick = (p: PlayerPick): PlayerPick => ({ playerId: p.playerId, nickname: p.nickname, avatar: p.avatar });

/** `count` questions: from one category, or from any (random), never repeating in the game; fresh ones first. */
export function pickPrompts(count: number, category: AuthorCategory | "random", used: ReadonlySet<string>): AuthorPrompt[] {
  const pool = category === "random" ? AUTHOR_PROMPT_LIST : AUTHOR_PROMPT_LIST.filter((p) => p.category === category);
  if (category !== "random") return pickFresh(pool, count, used);
  // Random: spread over categories (a different one each question while they last).
  const cats = shuffle([...AUTHOR_CATEGORIES]) as AuthorCategory[];
  const out: AuthorPrompt[] = [];
  for (let i = 0; i < count; i++) {
    const cat = cats[i % cats.length];
    const next = pickFresh(pool.filter((p) => p.category === cat && !out.includes(p)), 1, used)[0] ?? pickFresh(pool.filter((p) => !out.includes(p)), 1, used)[0];
    if (next) out.push(next);
  }
  return out;
}

/** Distinct random card numbers (10–99), so a card's number says nothing about who or when. */
function cardNumbers(n: number): number[] {
  return shuffle(Array.from({ length: 90 }, (_, i) => i + 10)).slice(0, n);
}

/** Everyone with the top score (at least `min`), alphabetically; empty when nobody reaches `min`. */
function allTop<T>(items: T[], score: (t: T) => number, name: (t: T) => string, min: number): { best: number; items: T[] } | null {
  const best = Math.max(0, ...items.map(score));
  if (best < min) return null;
  return { best, items: items.filter((t) => score(t) === best).sort((x, y) => name(x).localeCompare(name(y))) };
}

/** Fun stats for the end of the game. Ties share an award. */
export function awards(setup: AuthorSetup, players: PlayerPick[]): AuthorAwards {
  const byId = new Map(players.map((p) => [p.playerId, p]));
  for (const e of setup.entries) if (!byId.has(e.author.playerId)) byId.set(e.author.playerId, e.author);
  const everyone = [...byId.values()];
  const detectives = allTop(everyone, (p) => setup.correct[p.playerId] ?? 0, (p) => p.nickname, 1);
  const streakers = allTop(everyone, (p) => setup.best[p.playerId] ?? 0, (p) => p.nickname, 2);
  const obvious = allTop(
    setup.entries.filter((e) => (e.guessers ?? 0) > 0),
    (e) => e.found ?? 0,
    (e) => e.author.nickname,
    1,
  );
  return {
    bestDetective: detectives ? { players: detectives.items.map(pick), correct: detectives.best } : null,
    mostObvious: obvious ? { answers: obvious.items.map((e) => ({ answer: e.text, author: pick(e.author), guessers: e.guessers! })), found: obvious.best } : null,
    longestStreak: streakers ? { players: streakers.items.map(pick), streak: streakers.best } : null,
  };
}

/** Rounds still to come after `stepsPlanned`, estimated for questions not written yet (corrected at each write). */
function estimateTotal(setup: AuthorSetup, nextQuestion: number, players: number): number {
  return setup.steps.length + Math.max(0, setup.prompts.length - nextQuestion - 1) * (1 + players);
}

const LAST_REVEAL_MS = 20_000;

/**
 * The Author: everyone answers a question in secret, then each answer is shown with no name and the
 * others guess who wrote it. Each question is one write step plus one guess step per answer it got;
 * the steps are planned as answers come in (the round count grows to fit). Authors live only in the
 * server-only setup and round secret; only the author's own phone is told "this one is yours".
 */
export const theAuthor: GameHandler<AuthorSetup, AuthorRound, { author: string } | null> = {
  id: "the-author",
  introMs: 10_000,
  revealMs: 10_000,
  setup(players, used, settings) {
    const s = authorSettings(settings as Parameters<typeof authorSettings>[0]);
    const prompts = pickPrompts(s.rounds, s.category, used);
    const setup: AuthorSetup = {
      prompts,
      steps: [{ kind: "write", question: 0 }],
      entries: [],
      writeMs: s.writeSeconds * 1000,
      guessMs: s.guessSeconds * 1000,
      streak: {},
      best: {},
      correct: {},
      bonus: {},
      current: 0,
    };
    // Estimate (one write + one answer per player per question); corrected as answers come in.
    return { setup, rounds: Math.max(1, prompts.length * (1 + players.length)), contentIds: prompts.map((p) => p.id) };
  },
  openRound(setup, round, _nowMs, players) {
    const step = setup.steps[round - 1];
    if (!step) fail("internal", "No such step.");
    const opened = { ...setup, current: round - 1 };
    const prompt = setup.prompts[step.question];
    const streaks = Object.fromEntries(Object.entries(setup.streak).filter(([, n]) => n > 0));
    const base = { prompt: prompt.text, category: prompt.category, question: step.question + 1, questions: setup.prompts.length, streaks };
    if (step.kind === "write") {
      return {
        public: { kind: "write", ...base },
        secret: null,
        durationMs: setup.writeMs,
        label: `Question ${base.question} of ${base.questions}`,
        // Skipping would lose the answers (and the guessing steps they plan); "next" ends writing instead.
        skippable: false,
        // Clears last answer's "this one is yours".
        privateFor: {},
        setup: opened,
      };
    }
    const entry = setup.entries[step.entry];
    const ofQuestion = setup.entries.filter((e) => e.question === step.question);
    const index = ofQuestion.indexOf(entry) + 1;
    // Candidates in a fixed (alphabetical) order, so the list's order says nothing.
    const candidates = ofQuestion.map((e) => pick(e.author)).sort((a, b) => a.nickname.localeCompare(b.nickname));
    return {
      public: { kind: "guess", ...base, card: entry.card, answer: entry.text, index, count: ofQuestion.length, candidates },
      secret: { author: entry.author.playerId },
      durationMs: setup.guessMs,
      // The author can't guess their own answer (the engine also drops anyone who left).
      eligibleIds: players.filter((p) => p.playerId !== entry.author.playerId).map((p) => p.playerId),
      label: `Question ${base.question} · Answer ${index} of ${ofQuestion.length}`,
      privateFor: { [entry.author.playerId]: { yourAnswer: true } },
      setup: opened,
    };
  },
  validate(answer, pub, ctx) {
    const a = (answer ?? {}) as { text?: unknown; author?: unknown };
    if (pub.kind === "write") {
      if (typeof a.text !== "string") fail("invalid-argument", "Write an answer.");
      capRaw(a.text, AUTHOR_LIMITS.answerMax, "Your answer");
      const text = cleanText(a.text);
      if (!text) fail("invalid-argument", "Write an answer.");
      if ([...text].length > AUTHOR_LIMITS.answerMax) fail("invalid-argument", `Keep it under ${AUTHOR_LIMITS.answerMax} characters.`);
      return { text };
    }
    if (typeof a.author !== "string" || !pub.candidates.some((c) => c.playerId === a.author)) fail("invalid-argument", "Pick someone from the list.");
    if (a.author === ctx.playerId) fail("invalid-argument", "You can't pick yourself.");
    return { author: a.author };
  },
  score({ pub, secret, setup, submissions, players, allPlayers }): ScoredRound {
    const round = setup.current;
    const step = setup.steps[round];
    // The steps list always holds the next question's write step once it's due, so the last step is the game's last.
    const isLastStep = (steps: Step[]) => round === steps.length - 1;

    if (step.kind === "write") {
      const byId = new Map(players.map((p) => [p.playerId, p]));
      const written = shuffle(submissions.filter((s) => byId.has(s.playerId)));
      const cards = cardNumbers(written.length);
      const entries = [...setup.entries];
      const steps = [...setup.steps];
      for (const [i, s] of written.entries()) {
        entries.push({ question: step.question, author: pick(byId.get(s.playerId)!), text: (s.answer as { text: string }).text, card: cards[i] });
        steps.push({ kind: "guess", question: step.question, entry: entries.length - 1 });
      }
      const next = step.question + 1;
      if (next < setup.prompts.length) steps.push({ kind: "write", question: next });
      const updated: AuthorSetup = { ...setup, entries, steps };
      const done = isLastStep(steps);
      const feedback = Object.fromEntries(
        players.map((p) => [p.playerId, { correct: null, detail: byId.has(p.playerId) && written.some((s) => s.playerId === p.playerId) ? "Your answer is in the mix. Act natural!" : "No answer this time" }]),
      );
      return {
        points: {},
        feedback,
        setup: updated,
        totalRounds: next < setup.prompts.length ? estimateTotal(updated, next, allPlayers.length) : steps.length,
        reveal: { kind: "collected", prompt: pub.prompt, count: written.length, awards: done ? awards(updated, allPlayers) : null } satisfies AuthorReveal,
        revealMs: done ? LAST_REVEAL_MS : 4_000,
      };
    }

    // A guess step: score everyone who could guess (everyone but the author).
    const author = secret!.author;
    const entry = setup.entries[step.entry];
    // `players` = this round's eligible players: everyone but the author.
    const guessers = players.filter((p) => p.playerId !== author);
    const guesses = new Map(submissions.map((s) => [s.playerId, (s.answer as { author: string }).author]));
    const streak = { ...setup.streak };
    const best = { ...setup.best };
    const correct = { ...setup.correct };
    const bonusTotal = { ...setup.bonus };
    const points: Record<string, number> = {};
    const feedback: ScoredRound["feedback"] = {};
    const results: AuthorGuessResult[] = [];
    const votes = new Map<string, number>();
    for (const p of guessers) {
      const guess = guesses.get(p.playerId) ?? null;
      if (guess) votes.set(guess, (votes.get(guess) ?? 0) + 1);
      const right = guess === author;
      // A wrong or missing guess resets the streak; it carries over between answers and questions.
      streak[p.playerId] = right ? (streak[p.playerId] ?? 0) + 1 : 0;
      const s = streak[p.playerId];
      best[p.playerId] = Math.max(best[p.playerId] ?? 0, s);
      const base = right ? AUTHOR_POINTS.base : 0;
      const bonus = right ? authorBonus(s) : 0;
      if (right) {
        correct[p.playerId] = (correct[p.playerId] ?? 0) + 1;
        bonusTotal[p.playerId] = (bonusTotal[p.playerId] ?? 0) + bonus;
      }
      points[p.playerId] = base + bonus;
      feedback[p.playerId] = {
        correct: right,
        detail: guess === null ? "No guess this time" : right ? (s > 1 ? `${s} in a row! +${bonus} bonus` : "You found the author!") : `It was ${entry.author.nickname}`,
      };
      results.push({ ...pick(p), guess, correct: right, streak: s, base, bonus, points: base + bonus });
    }
    const found = results.filter((r) => r.correct).length;
    results.sort((a, b) => Number(b.correct) - Number(a.correct) || b.points - a.points || a.nickname.localeCompare(b.nickname));

    const ranked = [...votes.entries()].sort((a, b) => b[1] - a[1]);
    const nameOf = (id: string) => (pub.kind === "guess" ? pub.candidates.find((c) => c.playerId === id) : undefined) ?? entry.author;
    const mostGuessed = ranked.length ? { player: pick(nameOf(ranked[0][0])), votes: ranked[0][1], tied: ranked.filter((v) => v[1] === ranked[0][1]).length > 1 } : null;

    const entries = setup.entries.map((e, i) => (i === step.entry ? { ...e, found, guessers: guessers.length } : e));
    const updated: AuthorSetup = { ...setup, entries, streak, best, correct, bonus: bonusTotal };
    const done = isLastStep(setup.steps);
    return {
      points,
      feedback,
      setup: updated,
      reveal: {
        kind: "author",
        prompt: pub.prompt,
        card: entry.card,
        answer: entry.text,
        author: pick(entry.author),
        mostGuessed,
        votes: ranked.map(([playerId, n]) => ({ playerId, votes: n })),
        correctCount: found,
        guessers: guessers.length,
        results,
        awards: done ? awards(updated, allPlayers) : null,
      } satisfies AuthorReveal,
      ...(done ? { revealMs: LAST_REVEAL_MS } : {}),
    };
  },
  standingDetail(setup, playerId) {
    const c = setup.correct[playerId] ?? 0;
    const b = setup.bonus[playerId] ?? 0;
    const s = setup.best[playerId] ?? 0;
    return `${c} found · ${c * AUTHOR_POINTS.base} + ${b} bonus · streak ${s}`;
  },
};

