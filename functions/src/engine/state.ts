import type { GamePhase } from "../../../shared/engine";
import type { GameId } from "../../../shared/games";

/** rooms/{roomId}/gameState/current — authoritative, server-only (rules deny all client reads). */
export interface GameStateDoc {
  gameId: GameId;
  entryId: string;
  status: "active" | "ended";
  phase: GamePhase;
  round: number;
  totalRounds: number;
  phaseEndsAtMs: number | null;
  phaseDurationMs: number;
  paused: boolean;
  remainingMs: number | null;
  setup: unknown;
  roundPublic: unknown;
  roundSecret: unknown;
  roundOpenedAtMs: number | null;
  /** Players who may answer the current round (snapshot at round open). */
  eligibleIds: string[];
  /** Game points so far. */
  scores: Record<string, number>;
  /** Last reveal payload (kept so pause/resume can republish it). */
  lastReveal: unknown;
  /** From OpenedRound: label instead of "Round x of y", and whether the host may skip. */
  roundLabel?: string | null;
  skippable?: boolean;
  startedAtMs: number;
}
