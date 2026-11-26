import type { GamePhase } from "../../../shared/engine";
import type { GameId } from "../../../shared/games";

export interface EnginePlayer {
  playerId: string;
  nickname: string;
  avatar: string;
}

export interface EngineSubmission {
  playerId: string;
  answer: unknown;
  /** Server-clock ms when the submission was received. */
  submittedAtMs: number;
}

export interface OpenedRound<Pub = unknown, Sec = unknown> {
  /** Shown on the display and phones (must not contain answers). */
  public: Pub;
  /** Server-only (correct answers, etc.). */
  secret: Sec;
  /** Answer window. 0 = no time limit: the round ends when everyone answers or the host ends it. */
  durationMs: number;
  /** Who may answer this round (default: every player in the game). E.g. one clue-giver per turn. */
  eligibleIds?: string[];
  /** Shown instead of "Round x of y" (e.g. "Ana's turn"). */
  label?: string;
  /** False = the host can't skip this round (it decides the game). Default true. */
  skippable?: boolean;
  /**
   * Per-player secrets for this round, written to private/{uid}.secret (players not listed get null).
   * E.g. only Draw & Guess's artist gets the prompt. Absent = leave private secrets as they are.
   */
  privateFor?: Record<string, unknown>;
  /** Replaces the game's setup when the round opens (e.g. who has drawn so far). */
  setup?: unknown;
  /** Server-clock ms of the first mid-round event (see GameHandler.roundEvent). */
  eventAtMs?: number | null;
}

/** A multi-attempt game's verdict on one attempt (see GameHandler.check). */
export interface AttemptVerdict {
  /** True = stored as this player's answer for the round; false = rejected, nothing stored. */
  correct: boolean;
  /** Nearly right ("So close!"). */
  close?: boolean;
}

export interface ScoredRound {
  /** Points awarded this round per player (absent = 0). */
  points: Record<string, number>;
  /** Per-player feedback for their phone. */
  feedback: Record<string, { correct: boolean | null; detail: string | null }>;
  /** Public reveal payload. */
  reveal: unknown;
  /** Replaces the game's setup (state that carries between rounds, e.g. clues so far). */
  setup?: unknown;
  /** Changes how many rounds the game has (e.g. a revote adds one). */
  totalRounds?: number;
  /** How long this reveal shows. 0 = until the host moves on. Default: handler.revealMs. */
  revealMs?: number;
}

/** Result of a game-specific host action (controlGame action "game"). */
export interface HostActionResult<Setup = unknown> {
  setup?: Setup;
  totalRounds?: number;
  /** Replace the current reveal in place (points are added like a scored round). */
  scored?: ScoredRound;
  /** Then open the next round straight away. */
  advance?: boolean;
}

/** What a handler sees when validating one player's answer. */
export interface ValidateCtx<Setup = unknown> {
  playerId: string;
  setup: Setup;
}

/**
 * A server-side game. Pure and deterministic given its inputs (randomness only
 * in `setup`/`openRound`), so handlers are easy to unit test. The engine owns
 * persistence, timing, idempotency and security.
 */
export interface GameHandler<Setup = unknown, Pub = unknown, Sec = unknown> {
  id: GameId;
  introMs: number;
  revealMs: number;
  /**
   * Choose content for the whole game. `used` = content ids already played in this room.
   * `settings` = the host's options for this game from the room (may be missing; apply defaults).
   * `hostSecret` = the host-only options doc (rooms/{id}/hostSecrets/{gameId}), if any.
   */
  setup(players: EnginePlayer[], used: ReadonlySet<string>, settings?: unknown, hostSecret?: unknown): { setup: Setup; rounds: number; contentIds: string[] };
  /** `players` = everyone currently in the room (e.g. to choose who draws). */
  openRound(setup: Setup, round: number, nowMs: number, players: EnginePlayer[]): OpenedRound<Pub, Sec>;
  /** Normalize/validate a raw answer; throw HttpsError("invalid-argument") when invalid. */
  validate(answer: unknown, pub: Pub, ctx: ValidateCtx<Setup>): unknown;
  score(args: {
    pub: Pub;
    secret: Sec;
    /** The game's setup (state carried between rounds). */
    setup: Setup;
    submissions: EngineSubmission[];
    /** Players who could answer this round. */
    players: EnginePlayer[];
    /** Everyone currently in the game (for names/avatars beyond this round's answerers). */
    allPlayers: EnginePlayer[];
    openedAtMs: number;
    durationMs: number;
  }): ScoredRound;
  /**
   * Multi-attempt rounds (Draw & Guess): judge each validated attempt. Only a correct one is stored
   * (once per player per round); a wrong one returns to the player to try again. Absent = the first
   * valid answer is final.
   */
  check?(answer: unknown, pub: Pub, secret: Sec): AttemptVerdict;
  /** Publish who has answered so far (names only) in PublicGameState.answeredBy. */
  showAnswerers?: boolean;
  /**
   * Multi-attempt rounds: minimum ms between one player's attempts (Word Scramble: 5 s). Enforced by
   * the server per player per round (attempts/{entry_round_uid}); a new round starts fresh.
   */
  attemptCooldownMs?: number;
  /** A per-player stat shown on the final results (e.g. "7 words solved"), from the final setup. */
  standingDetail?(setup: Setup, playerId: string): string | undefined;
  /**
   * A timed change during a round (Draw & Guess reveals a letter). Runs once `dueAtMs` (the
   * scheduled time) passes on the server clock; returns the new public payload and when the next
   * event is due (null = no more). Scheduling shifts with pauses like the deadline.
   */
  roundEvent?(args: { pub: Pub; secret: Sec; setup: Setup; dueAtMs: number }): { pub: Pub; nextAtMs: number | null };
  /** Shift absolute times in the round payload after a pause (e.g. Reflex's go time). */
  shiftTimes?(pub: Pub, secret: Sec, deltaMs: number): { pub: Pub; secret: Sec };
  /** Private info for one player, written to private/{uid}.secret when the game starts (roles, secret words). */
  privateInfo?(setup: Setup, playerId: string): unknown;
  /** Game-specific host actions (e.g. The Impostor's "revote"). Throw HttpsError when not allowed now. */
  hostAction?(
    name: string,
    state: { setup: Setup; round: number; totalRounds: number; phase: GamePhase; lastReveal: unknown; players: EnginePlayer[] },
  ): HostActionResult<Setup>;
  /** Return a message to stop the host's "Next" (e.g. a tied vote must be settled first). */
  blockAdvance?(state: { setup: Setup; phase: GamePhase; lastReveal: unknown }): string | undefined;
}
