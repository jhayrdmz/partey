import type { ScrambleCategory, ScrambleDifficulty, ScrambleReveal, ScrambleRound } from "../../../shared/engine";
import { SCRAMBLE_LIMITS, scramblePoints, scrambleSettings, scrambleSpeedBonus, type ScrambleSettings } from "../../../shared/gameSettings";
import { fail } from "../lib/errors";
import { capRaw, cleanText } from "../lib/validate";
import type { GameHandler, ScoredRound } from "../engine/types";
import { pickFresh, shuffle } from "../engine/random";
import { ALL_SCRAMBLE_WORDS } from "./scrambleContent";

export interface ScrambleSetup {
  words: { word: string; category: ScrambleCategory; difficulty: ScrambleDifficulty }[];
  roundMs: number;
  hints: boolean;
  speedBonus: boolean;
  /** Words each player has solved (for the final results). */
  solved: Record<string, number>;
}

interface Secret {
  word: string;
}

/** Answers compare as letters only, case-insensitively ("  Tiger " = "TIGER"). */
export const normalizeWord = (text: string) => text.toUpperCase().replace(/[^A-Z]/g, "");

/** A random order of the word's letters that never spells the word itself. */
export function scramble(word: string): string[] {
  const letters = [...word];
  if (new Set(letters).size < 2) return letters; // nothing to shuffle (never in our list)
  for (let i = 0; i < 50; i++) {
    const out = shuffle(letters);
    if (out.join("") !== word) return out;
  }
  return [...letters.slice(1), letters[0]]; // rotation: always differs when the letters do
}

/** Speed bonus (shared with phones, which show it the moment you solve the word). */
export const speedBonus = scrambleSpeedBonus;

export const wordScramble: GameHandler<ScrambleSetup, ScrambleRound, Secret> = {
  id: "word-scramble",
  introMs: 8_000,
  revealMs: 6_000, // the short transition before the next word
  showAnswerers: true,
  attemptCooldownMs: SCRAMBLE_LIMITS.cooldownMs,

  setup(_players, used, settings) {
    const options: ScrambleSettings = scrambleSettings(settings as Partial<ScrambleSettings> | undefined);
    const pool = ALL_SCRAMBLE_WORDS.filter(
      (w) => (options.category === "random" || w.category === options.category) && (options.difficulty === "mixed" || w.difficulty === options.difficulty),
    );
    if (pool.length === 0) fail("failed-precondition", "No words match those options. Pick another category or difficulty.");
    const picked = pickFresh(pool, options.rounds, used);
    const setup: ScrambleSetup = {
      words: picked.map((w) => ({ word: w.word, category: w.category, difficulty: w.difficulty })),
      roundMs: options.roundSeconds * 1000,
      hints: options.hints,
      speedBonus: options.speedBonus,
      solved: {},
    };
    return { setup, rounds: picked.length, contentIds: picked.map((w) => w.id) };
  },

  openRound(setup, round, nowMs) {
    const w = setup.words[round - 1];
    return {
      public: { letters: scramble(w.word), category: w.category, difficulty: w.difficulty, hints: [], cooldownMs: SCRAMBLE_LIMITS.cooldownMs, speedBonus: setup.speedBonus },
      secret: { word: w.word },
      durationMs: setup.roundMs,
      // Hints: the first letter halfway through, the last letter with a quarter of the time left.
      eventAtMs: setup.hints ? nowMs + setup.roundMs / 2 : null,
    };
  },

  roundEvent({ pub, secret, setup, dueAtMs }) {
    const word = secret.word;
    if (pub.hints.length === 0) {
      return { pub: { ...pub, hints: [{ index: 0, letter: word[0] }] }, nextAtMs: word.length >= 5 ? dueAtMs + setup.roundMs / 4 : null };
    }
    if (pub.hints.length === 1) {
      return { pub: { ...pub, hints: [...pub.hints, { index: word.length - 1, letter: word[word.length - 1] }] }, nextAtMs: null };
    }
    return { pub, nextAtMs: null };
  },

  validate(answer) {
    const raw = (answer as { guess?: unknown } | null)?.guess;
    if (typeof raw !== "string") fail("invalid-argument", "Type your answer.");
    capRaw(raw, SCRAMBLE_LIMITS.guessMax, "Answers");
    const guess = cleanText(raw);
    if (!normalizeWord(guess)) fail("invalid-argument", "Type your answer.");
    if ([...guess].length > SCRAMBLE_LIMITS.guessMax) fail("invalid-argument", `Answers are at most ${SCRAMBLE_LIMITS.guessMax} characters.`);
    return { guess };
  },

  check(answer, _pub, secret) {
    return { correct: normalizeWord((answer as { guess: string }).guess) === secret.word };
  },

  score({ pub, secret, setup, submissions, players, openedAtMs, durationMs }) {
    // Every stored submission is a correct answer (wrong ones are never stored). Order = server receive time.
    const byId = new Map(players.map((p) => [p.playerId, p]));
    const ordered = [...submissions]
      .filter((s) => byId.has(s.playerId))
      .sort((a, b) => a.submittedAtMs - b.submittedAtMs || a.playerId.localeCompare(b.playerId));
    const points: Record<string, number> = {};
    const feedback: ScoredRound["feedback"] = {};
    const solved = { ...setup.solved };
    const solvers: ScrambleReveal["solvers"] = ordered.map((s, i) => {
      const ms = Math.max(0, s.submittedAtMs - openedAtMs);
      const bonus = setup.speedBonus ? speedBonus(ms, durationMs) : 0;
      const pts = scramblePoints(i) + bonus;
      points[s.playerId] = pts;
      solved[s.playerId] = (solved[s.playerId] ?? 0) + 1;
      feedback[s.playerId] = { correct: true, detail: `#${i + 1} to solve ${secret.word} · ${(ms / 1000).toFixed(1)}s${bonus ? ` · +${bonus} speed bonus` : ""}` };
      return { ...byId.get(s.playerId)!, ms, points: pts, bonus };
    });
    for (const p of players) feedback[p.playerId] ??= { correct: false, detail: `Time's up! It was ${secret.word}` };
    const reveal: ScrambleReveal = { word: secret.word, category: pub.category, solvers, eligible: players.length };
    return { points, feedback, reveal, setup: { ...setup, solved } };
  },

  standingDetail(setup, playerId) {
    const n = setup.solved?.[playerId] ?? 0;
    return `${n} word${n === 1 ? "" : "s"} solved`;
  },
};
