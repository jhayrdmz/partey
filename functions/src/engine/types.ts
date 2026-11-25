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
  durationMs: number;
}

export interface ScoredRound {
  /** Points awarded this round per player (absent = 0). */
  points: Record<string, number>;
  /** Per-player feedback for their phone. */
  feedback: Record<string, { correct: boolean | null; detail: string | null }>;
  /** Public reveal payload. */
  reveal: unknown;
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
  /** Choose content for the whole game. `used` = content ids already played in this room. */
  setup(players: EnginePlayer[], used: ReadonlySet<string>): { setup: Setup; rounds: number; contentIds: string[] };
  openRound(setup: Setup, round: number, nowMs: number): OpenedRound<Pub, Sec>;
  /** Normalize/validate a raw answer; throw HttpsError("invalid-argument") when invalid. */
  validate(answer: unknown, pub: Pub): unknown;
  score(args: {
    pub: Pub;
    secret: Sec;
    submissions: EngineSubmission[];
    players: EnginePlayer[];
    openedAtMs: number;
    durationMs: number;
  }): ScoredRound;
  /** Shift absolute times in the round payload after a pause (e.g. Reflex's go time). */
  shiftTimes?(pub: Pub, secret: Sec, deltaMs: number): { pub: Pub; secret: Sec };
}
