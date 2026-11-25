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
}

export interface TickGameRequest {
  roomId: string;
  round: number;
  phase: GamePhase;
}

export type GameControlAction = "pause" | "resume" | "skip" | "next";
export interface ControlGameRequest {
  roomId: string;
  action: GameControlAction;
}
