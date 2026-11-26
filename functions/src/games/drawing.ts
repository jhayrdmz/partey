import { randomInt } from "node:crypto";
import type { DrawCategory, DrawReveal, DrawRound, DrawSecret, PlayerPick } from "../../../shared/engine";
import { DRAWING_LIMITS, drawingSettings, type DrawingSettings } from "../../../shared/gameSettings";
import { DRAW_POINTS, guessPoints } from "../../../shared/drawing";

export { DRAW_POINTS, guessPoints };
import { fail } from "../lib/errors";
import { cleanText } from "../lib/validate";
import { generateId } from "../lib/codes";
import type { EnginePlayer, GameHandler, ScoredRound } from "../engine/types";
import { pickFresh, shuffle } from "../engine/random";
import { ALL_DRAW_PROMPTS, type DrawPrompt } from "./drawingContent";


/** Longest guess accepted (characters). */
export const MAX_GUESS_LENGTH = 40;

export interface DrawingSetup {
  /** Unique per game: namespaces this game's strokes in the Realtime Database. */
  gameKey: string;
  prompts: { word: string; answers: string[]; category: DrawCategory }[];
  drawMs: number;
  /** A letter hint every this many ms; 0 = no hints. Missing in games started before hints. */
  hintMs?: number;
  rounds: number;
  /** Turns drawn so far, per player (fair rotation). */
  drawn: Record<string, number>;
  lastArtistId: string | null;
}

interface Secret {
  word: string;
  /** Accepted answers, normalized. */
  answers: string[];
  /** The prompt's letters (letters and digits only, as written), indexed like DrawRound.revealed. */
  letters?: string[];
  /** Which letters the hints reveal, in order (chosen when the round opens). */
  hintOrder?: number[];
}

/** Letters and digits of a prompt, as written ("Ice cream" → I, c, e, c, r, e, a, m). */
export const promptLetters = (word: string) => [...word].filter((ch) => /[\p{L}\p{N}]/u.test(ch));

/** At most a third of the letters (and never more than half), so hints never give the word away. */
export function maxHints(letterCount: number): number {
  return Math.min(Math.ceil(letterCount / 3), Math.floor(letterCount / 2));
}

const pick = (p: PlayerPick): PlayerPick => ({ playerId: p.playerId, nickname: p.nickname, avatar: p.avatar });

/** Compare guesses loosely: case, accents, spaces, punctuation and a leading article don't matter. */
export function normalizeGuess(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .trim()
    .replace(/^(a|an|the|ang|ng|mga)\s+/u, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

/** Edit distance, capped early (only small distances matter). */
function distance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

/** Right, nearly right, or wrong. A plural/singular "s" counts as right. */
export function judgeGuess(guess: string, answers: string[]): { correct: boolean; close: boolean } {
  const g = normalizeGuess(guess);
  if (!g) return { correct: false, close: false };
  const plural = (a: string, b: string) => a === b || a === `${b}s` || b === `${a}s` || a === `${b}es` || b === `${a}es`;
  if (answers.some((a) => plural(g, a))) return { correct: true, close: false };
  // "So close": one typo (two for long words). Never for very short words, where it gives too much away.
  const close = answers.some((a) => a.length >= 4 && distance(g, a) <= (a.length >= 8 ? 2 : 1));
  return { correct: false, close };
}


/**
 * Who draws next: someone present who has drawn the fewest turns, never the last artist when anyone
 * else can, chosen at random among those. So everyone draws once before anyone draws twice.
 */
export function chooseArtist(setup: DrawingSetup, players: EnginePlayer[]): EnginePlayer {
  if (players.length === 0) fail("failed-precondition", "Nobody is left to draw.");
  const others = players.length > 1 ? players.filter((p) => p.playerId !== setup.lastArtistId) : players;
  const fewest = Math.min(...others.map((p) => setup.drawn[p.playerId] ?? 0));
  const pool = others.filter((p) => (setup.drawn[p.playerId] ?? 0) === fewest);
  return pool[randomInt(pool.length)];
}

export const drawing: GameHandler<DrawingSetup, DrawRound, Secret> = {
  id: "drawing",
  introMs: 10_000,
  revealMs: 10_000,
  showAnswerers: true,

  setup(players, used, settings) {
    const options: DrawingSettings = drawingSettings(settings as Partial<DrawingSettings> | undefined);
    if (players.length < DRAWING_LIMITS.minPlayers) fail("failed-precondition", `Draw & Guess needs at least ${DRAWING_LIMITS.minPlayers} players.`);
    const pool = ALL_DRAW_PROMPTS.filter((p) => options.categories.includes(p.category));
    // The same word can sit in two categories; never draw it twice in one game.
    const seen = new Set<string>();
    const prompts: DrawPrompt[] = [];
    for (const p of pickFresh(pool, pool.length, used)) {
      const key = normalizeGuess(p.word);
      if (seen.has(key)) continue;
      seen.add(key);
      prompts.push(p);
      if (prompts.length === options.rounds) break;
    }
    const setup: DrawingSetup = {
      gameKey: generateId(8),
      prompts: prompts.map((p) => ({ word: p.word, answers: p.answers, category: p.category })),
      drawMs: options.drawSeconds * 1000,
      hintMs: options.hintSeconds * 1000,
      rounds: prompts.length,
      drawn: {},
      lastArtistId: null,
    };
    return { setup, rounds: prompts.length, contentIds: prompts.map((p) => p.id) };
  },

  openRound(setup, round, nowMs, players) {
    const prompt = setup.prompts[round - 1];
    const letters = promptLetters(prompt.word);
    const hintMs = setup.hintMs ?? 0;
    const hintOrder = hintMs > 0 ? shuffle(letters.map((_, i) => i)).slice(0, maxHints(letters.length)) : [];
    const artist = chooseArtist(setup, players);
    const secret: DrawSecret = { role: "artist", word: prompt.word, category: prompt.category };
    const guesser: DrawSecret = { role: "guesser" };
    return {
      public: {
        artist: pick(artist),
        category: prompt.category,
        hint: prompt.word.split(/\s+/).map((w) => [...w.replace(/[^\p{L}\p{N}]/gu, "")].length).filter((n) => n > 0),
        drawingKey: `${setup.gameKey}_${round}`,
        revealed: [],
      },
      secret: { word: prompt.word, answers: prompt.answers.map(normalizeGuess), letters, hintOrder },
      eventAtMs: hintOrder.length > 0 ? nowMs + hintMs : null,
      durationMs: setup.drawMs,
      // Everyone but the artist guesses.
      eligibleIds: players.filter((p) => p.playerId !== artist.playerId).map((p) => p.playerId),
      label: `Round ${round} of ${setup.rounds} · ${artist.nickname} draws`,
      privateFor: Object.fromEntries(players.map((p) => [p.playerId, p.playerId === artist.playerId ? secret : guesser])),
      setup: { ...setup, drawn: { ...setup.drawn, [artist.playerId]: (setup.drawn[artist.playerId] ?? 0) + 1 }, lastArtistId: artist.playerId },
    };
  },

  /** The next letter hint. */
  roundEvent({ pub, secret, setup, dueAtMs }) {
    const order = secret.hintOrder ?? [];
    const letters = secret.letters ?? [];
    const k = (pub.revealed ?? []).length;
    if (k >= order.length) return { pub, nextAtMs: null };
    const index = order[k];
    const revealed = [...(pub.revealed ?? []), { index, letter: letters[index] }].sort((a, b) => a.index - b.index);
    return { pub: { ...pub, revealed }, nextAtMs: k + 1 < order.length ? dueAtMs + (setup.hintMs ?? 0) : null };
  },

  validate(answer) {
    const raw = (answer as { guess?: unknown } | null)?.guess;
    if (typeof raw !== "string") fail("invalid-argument", "Type your guess.");
    const guess = cleanText(raw);
    if (!guess) fail("invalid-argument", "Type your guess.");
    if ([...guess].length > MAX_GUESS_LENGTH) fail("invalid-argument", `Guesses are at most ${MAX_GUESS_LENGTH} characters.`);
    return { guess };
  },

  check(answer, _pub, secret) {
    return judgeGuess((answer as { guess: string }).guess, secret.answers);
  },

  score({ pub, secret, submissions, players, openedAtMs }) {
    // Every stored submission is a correct guess (wrong ones are never stored). Order = speed.
    const byId = new Map(players.map((p) => [p.playerId, p]));
    const ordered = [...submissions]
      .filter((s) => byId.has(s.playerId))
      .sort((a, b) => a.submittedAtMs - b.submittedAtMs || a.playerId.localeCompare(b.playerId));
    const points: Record<string, number> = {};
    const feedback: ScoredRound["feedback"] = {};
    const guessers: DrawReveal["guessers"] = ordered.map((s, i) => {
      const ms = Math.max(0, s.submittedAtMs - openedAtMs);
      const pts = guessPoints(i);
      points[s.playerId] = pts;
      feedback[s.playerId] = { correct: true, detail: `#${i + 1} to guess “${secret.word}” · ${(ms / 1000).toFixed(1)}s` };
      return { ...pick(byId.get(s.playerId)!), ms, points: pts };
    });
    for (const p of players) feedback[p.playerId] ??= { correct: false, detail: `It was “${secret.word}”` };

    const artistPoints = guessers.length > 0 ? DRAW_POINTS.artistBonus : 0;
    points[pub.artist.playerId] = (points[pub.artist.playerId] ?? 0) + artistPoints;
    feedback[pub.artist.playerId] = {
      correct: guessers.length > 0,
      detail: guessers.length > 0 ? `${guessers.length} of ${players.length} guessed “${secret.word}”` : `Nobody guessed “${secret.word}”`,
    };

    const reveal: DrawReveal = {
      word: secret.word,
      category: pub.category,
      artist: pub.artist,
      guessers,
      artistPoints,
      eligible: players.length,
      drawingKey: pub.drawingKey,
    };
    return { points, feedback, reveal };
  },
};
