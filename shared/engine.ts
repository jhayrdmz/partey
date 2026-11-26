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

export interface StandingEntry {
  playerId: string;
  nickname: string;
  avatar: string;
  score: number;
  /** Change this game (tournament leaderboard: placement points awarded). */
  delta?: number;
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
