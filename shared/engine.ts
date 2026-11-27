/**
 * Game engine contracts shared by Cloud Functions and the web client.
 *
 * Lifecycle of a game (server-authoritative):
 *
 *   intro ──▶ question ──▶ reveal ──▶ question ──▶ reveal … ──▶ (finalize → room.waiting | finished)
 *
 * Phase deadlines are server-clock milliseconds. Any player or the host may call
 * `tickGame` once a deadline passes; the server re-checks its own clock, so the
 * call can't be used to skip time.
 */
import type { GameId } from "./games";

export type GamePhase = "intro" | "question" | "reveal";

/** Places for entries sorted by score (highest first): ties share a place (1, 2, 2, 4), like the phones' ranks. */
export function sharedPlaces(sorted: readonly { score: number }[]): number[] {
  const out: number[] = [];
  sorted.forEach((s, i) => out.push(i > 0 && sorted[i - 1].score === s.score ? out[i - 1] : i + 1));
  return out;
}

export interface StandingEntry {
  playerId: string;
  nickname: string;
  avatar: string;
  score: number;
  /** Change this game (tournament leaderboard: placement points awarded). */
  delta?: number;
  /** A game's per-player stat for the final results, e.g. "7 words solved" (Word Scramble). */
  detail?: string;
}

/** Live game info inside displayState (public). */
export interface PublicGameState {
  phase: GamePhase;
  /** 1-based; 0 during intro. */
  round: number;
  totalRounds: number;
  phaseEndsAtMs: number | null;
  phaseDurationMs: number;
  paused: boolean;
  /** Remaining time captured when paused. */
  remainingMs: number | null;
  submitted: number;
  eligible: number;
  /** Game-specific public round payload (question, options, go time…). */
  round_data: unknown;
  /** Game-specific public reveal payload (only during reveal). */
  reveal: unknown;
  /** Live game scores (top entries). */
  standings: StandingEntry[];
  /** Game-provided name for the current step (e.g. "Ana's turn"); replaces "Round x of y" when set. */
  roundLabel?: string | null;
  /** False when the host can't skip this round (e.g. The Impostor's vote). */
  skippable?: boolean;
  /**
   * Players who have answered this round, in answer order (games that name them live, e.g.
   * Draw & Guess's correct guessers). Only names: never the answers themselves.
   */
  answeredBy?: (PlayerPick & { atMs: number })[];
  /**
   * Server-clock ms of the next mid-round event (e.g. Draw & Guess's next letter hint); null when
   * none is due or the game is paused. Devices call tickGame({ event: true }) when it passes.
   */
  eventAtMs?: number | null;
}

/** rooms/{roomId}/private/{uid} — what one player needs, readable only by them. */
export interface PlayerPrivateDoc {
  gameId: GameId | null;
  round: number;
  phase: GamePhase | null;
  /** The player's normalized answer for the current round, if submitted. */
  answer: unknown;
  answered: boolean;
  /** Result of the last revealed round. */
  lastRound: { round: number; points: number; correct: boolean | null; detail: string | null } | null;
  gameScore: number;
  rank: number | null;
  /** Game-specific private info (secret word, role…). */
  secret: unknown;
}

/* ─── Game payloads ──────────────────────────────────────────────────── */

export interface ChoiceQuestion {
  prompt: string;
  options: string[];
  category?: string;
}

export interface PlayerPick {
  playerId: string;
  nickname: string;
  avatar: string;
}

export interface SpeedQuizReveal {
  correctIndex: number;
  counts: number[];
  /** Correct answerers, fastest first. */
  fastest: (PlayerPick & { ms: number; points: number })[];
}

export interface MajorityReveal {
  counts: number[];
  majority: number[];
  /** Who picked what (flat: Firestore doesn't allow nested arrays). */
  picks: (PlayerPick & { choice: number })[];
}

export interface ReflexRound {
  /** Server-clock ms when GO appears. */
  goAtMs: number;
}

export interface ReflexReveal {
  results: (PlayerPick & { reactionMs: number | null; falseStart: boolean; points: number })[];
}

/* ─── The Impostor ─────────────────────────────────────────────────────── */

export const IMPOSTOR_CATEGORIES = ["food", "animals", "places", "objects", "movies"] as const;
export type ImpostorCategory = (typeof IMPOSTOR_CATEGORIES)[number];

export interface ImpostorClue extends PlayerPick {
  /** Null when the turn ended without a typed clue (said aloud, skipped or timed out). */
  clue: string | null;
  clueRound: number;
}

/** Public round data. Never contains the secret word or anyone's role. */
export type ImpostorRound =
  | {
      kind: "turn";
      turnPlayer: PlayerPick;
      /** 1-based position in the whole clue phase, and its length. */
      turn: number;
      turns: number;
      clueRound: number;
      clueRounds: number;
      category: ImpostorCategory;
      clues: ImpostorClue[];
    }
  | {
      kind: "vote";
      /** Who can be voted for (everyone, or the tied players on a revote). */
      candidates: PlayerPick[];
      revote: boolean;
      category: ImpostorCategory;
      clues: ImpostorClue[];
    };

export interface ImpostorOutcome {
  winner: "crew" | "impostor";
  /** Most-voted player (null when it was a tie the host didn't revote, or nobody voted). */
  accused: PlayerPick | null;
  impostors: PlayerPick[];
  word: string;
  category: ImpostorCategory;
  /** The impostor won because the vote stayed tied. */
  byTie: boolean;
}

export type ImpostorReveal =
  | { kind: "clue"; player: PlayerPick; clue: string | null }
  | {
      kind: "votes";
      tally: (PlayerPick & { votes: number })[];
      /** Who voted for whom; shown only now that everyone has voted. */
      ballots: { voterId: string; voterName: string; targetId: string }[];
      /** Set when the top spot is shared: the host chooses Revote or Reveal. */
      tied: PlayerPick[];
      /** Set once the game is decided (no tie, or the host revealed after a tie). */
      outcome: ImpostorOutcome | null;
    };

/** Private, per player (private/{uid}.secret). */
export interface ImpostorSecret {
  role: "crew" | "impostor";
  /** The secret word; null for impostors. */
  word: string | null;
  category: ImpostorCategory;
  /** Other impostors (when there is more than one). */
  partners: PlayerPick[];
}

export type ImpostorAnswer = { clue: string } | { vote: string };

/* ─── Draw & Guess ─────────────────────────────────────────────────────── */

export const DRAW_CATEGORIES = ["animals", "food", "objects", "places", "movies", "sports", "school", "filipino"] as const;
export type DrawCategory = (typeof DRAW_CATEGORIES)[number];

/** Public round data. Never contains the prompt: only its shape (letters per word). */
export interface DrawRound {
  artist: PlayerPick;
  category: DrawCategory;
  /** Letters per word, e.g. [5, 4] for "Ice cream". */
  hint: number[];
  /**
   * Letter hints revealed so far. `index` counts letters only, across all words (0 = the first
   * letter of the first word). Grows during the round; never the whole word.
   */
  revealed: { index: number; letter: string }[];
  /** RTDB key of this round's strokes: drawings/{roomId}/strokes/{drawingKey}. */
  drawingKey: string;
}

export interface DrawReveal {
  word: string;
  category: DrawCategory;
  artist: PlayerPick;
  /** Correct guessers, fastest first. */
  guessers: (PlayerPick & { ms: number; points: number })[];
  artistPoints: number;
  /** How many could guess (everyone but the artist). */
  eligible: number;
  drawingKey: string;
}

/** Private, per player, per round (private/{uid}.secret). Only the artist gets the prompt. */
export type DrawSecret = { role: "artist"; word: string; category: DrawCategory } | { role: "guesser" };

export type DrawAnswer = { guess: string };

/* ─── Word Scramble ────────────────────────────────────────────────────── */

export const SCRAMBLE_CATEGORIES = ["general", "animals", "food", "technology", "geography", "science", "sports", "entertainment"] as const;
export type ScrambleCategory = (typeof SCRAMBLE_CATEGORIES)[number];
export const SCRAMBLE_DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type ScrambleDifficulty = (typeof SCRAMBLE_DIFFICULTIES)[number];

/** Public round data: the scramble only, never the word. Same for every player. */
export interface ScrambleRound {
  /** Shuffled letters, uppercase (never in the word's own order). */
  letters: string[];
  category: ScrambleCategory;
  difficulty: ScrambleDifficulty;
  /** Hints revealed so far (when hints are on): a letter in its place in the answer. */
  hints: { index: number; letter: string }[];
  /** Minimum time between one player's guesses. */
  cooldownMs: number;
  /** The host turned on the speed bonus (so phones can show exact points as soon as they solve it). */
  speedBonus: boolean;
}

export interface ScrambleReveal {
  word: string;
  category: ScrambleCategory;
  /** Correct answers, in order. `points` includes any speed bonus. */
  solvers: (PlayerPick & { ms: number; points: number; bonus: number })[];
  /** How many could answer. */
  eligible: number;
}

export type ScrambleAnswer = { guess: string };

/* ─── Perfectly Hold ───────────────────────────────────────────────────── */

/**
 * Public round data. The target is public (it's on the big screen); the phone never shows it or a
 * running clock while holding. Each phone measures its own hold with performance.now().
 */
export interface HoldRound {
  targetMs: number;
  /** Server-clock ms when holding may start (after the target announcement and 3, 2, 1). */
  goAtMs: number;
  /** Longest hold accepted; phones let go by themselves here. */
  maxHoldMs: number;
  /** Who plays this round, for the display's Waiting / Locked in board. */
  players: PlayerPick[];
}

export interface HoldReveal {
  targetMs: number;
  /** Closest first (ties share a rank), then players who didn't hold (holdMs null). */
  results: (PlayerPick & { holdMs: number | null; diffMs: number | null; rank: number | null; points: number })[];
}

export type HoldAnswer = { holdMs: number };

/* ─── Cup Shuffle ──────────────────────────────────────────────────────── */

/**
 * Public round data: the whole shuffle, so every screen plays the same animation from the server
 * clock. The ball's start cup is public (the big screen shows it); where it ends up is never stored
 * here or sent to phones until the reveal. Slots are 0 (left), 1 (middle), 2 (right).
 */
export interface CupSwap {
  a: number;
  b: number;
}

export interface CupRound {
  /** Slot of the cup lifted to show the ball. */
  ballStart: number;
  /** Server-clock ms: the cup lifts to show the ball. */
  peekAtMs: number;
  /** Server-clock ms: the first swap starts (swaps run back to back). */
  shuffleAtMs: number;
  /** One swap's duration (shorter once 30%, 60% and 80% of the rounds are played). */
  swapMs: number;
  /** 0–3: how many times the shuffle has sped up (for "Faster!" on screen). */
  speedTier: number;
  /** Each swap exchanges the cups in slots a and b (a passes in front). Objects: Firestore can't nest arrays. */
  swaps: CupSwap[];
  /** Server-clock ms: the cups stop and phones may pick. */
  guessAtMs: number;
}

export interface CupReveal {
  /** Where the ball is. */
  ballSlot: number;
  /** Picks per slot. */
  counts: [number, number, number];
  /** Everyone in the round, right answers first; choice null = no pick. */
  results: (PlayerPick & {
    choice: number | null;
    correct: boolean;
    /** Right picks in a row, this one included (0 after a miss). */
    streak: number;
    /** Streak bonus included in `points`. */
    bonus: number;
    points: number;
  })[];
}

export type CupAnswer = { choice: number };

/* ─── Number Rush ──────────────────────────────────────────────────────── */

export type RushChoice = "higher" | "lower";

/** Public round data: the number on screen. The next one is server-only until the reveal. */
export interface RushRound {
  current: number;
  /** Players on a streak going into this round, longest first (for streak badges on every screen). */
  onStreak: (PlayerPick & { streak: number })[];
}

export interface RushReveal {
  previous: number;
  next: number;
  direction: RushChoice;
  /** Everyone in the round, most points this round first. choice null = no prediction. */
  results: (PlayerPick & {
    choice: RushChoice | null;
    correct: boolean;
    /** Right predictions in a row after this round (0 = reset). */
    streak: number;
    /** Multiplier applied this round (0 when wrong or missed). */
    multiplier: number;
    points: number;
    /** This game's total after this round (before = total − points), for the leaderboard's moves. */
    total: number;
  })[];
}

export type RushAnswer = { choice: RushChoice };

/* ─── Submissions ────────────────────────────────────────────────────── */

export type ChoiceAnswer = { choice: number };
export type ReflexAnswer = { tap: true };

export interface SubmitAnswerRequest {
  roomId: string;
  round: number;
  answer: unknown;
}
export interface SubmitAnswerResponse {
  accepted: boolean;
  /**
   * Games that allow several attempts (Draw & Guess): false = a wrong guess, nothing stored, try again.
   * Absent for one-shot games.
   */
  correct?: boolean;
  /** A wrong guess that was nearly right ("So close!"). */
  close?: boolean;
  /** Games with a guess cooldown (Word Scramble): server-clock ms when this player may guess again. */
  retryAtMs?: number;
}

export interface TickGameRequest {
  roomId: string;
  round: number;
  phase: GamePhase;
  /** A mid-round event is due (PublicGameState.eventAtMs), not the phase deadline. */
  event?: boolean;
}

/** "game" runs a game-specific host action named by `name` (e.g. The Impostor's "revote"). */
export type GameControlAction = "pause" | "resume" | "skip" | "next" | "game";
export interface ControlGameRequest {
  roomId: string;
  action: GameControlAction;
  name?: string;
}
