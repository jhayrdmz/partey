/**
 * Shared constants used by both the web client and Cloud Functions.
 * Keep this file free of runtime dependencies.
 */

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;

/** Room expiration policy (see docs/ARCHITECTURE.md → "Room expiration"). */
export const EXPIRY = {
  /** Waiting room with no activity. */
  waitingInactivityMs: 30 * MINUTE_MS,
  /** Host disconnected: reconnection grace period. */
  hostGraceMs: 8 * HOUR_MS,
  /** Individual player disconnected: reconnection grace period. */
  playerGraceMs: 8 * HOUR_MS,
  /** Everyone disconnected: room grace period. */
  allDisconnectedGraceMs: 8 * HOUR_MS,
  /** Room finished: time before it expires. */
  finishedMs: 15 * MINUTE_MS,
  /** Extra time after logical expiry before Firestore TTL physically deletes the doc. */
  ttlBufferMs: 24 * HOUR_MS,
} as const;

/** Default display pairing code lifetime. Server-configurable via PAIRING_CODE_TTL_SECONDS. */
export const DEFAULT_PAIRING_TTL_SECONDS = 180;

/** Player room codes use an alphabet without look-alike characters (no I, O, 0, 1, L). */
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ";
export const ROOM_CODE_LENGTH = 4;

export const PAIRING_CODE_LENGTH = 6;

export const LIMITS = {
  roomNameMin: 2,
  roomNameMax: 40,
  nicknameMin: 1,
  nicknameMax: 16,
  maxPlayersPerRoom: 24,
  maxDisplaysPerRoom: 4,
  maxLineupLength: 20,
  /** Failed pairing attempts allowed per uid per window. */
  pairingAttemptsPerWindow: 10,
  pairingAttemptWindowMs: 10 * MINUTE_MS,
  /** New display codes per display per window (codes auto-refresh every few minutes). */
  displayCodesPerWindow: 30,
} as const;

/** Default tournament placement points: index 0 = first place. */
export const DEFAULT_PLACEMENT_POINTS = [100, 60, 30] as const;
export const DEFAULT_OTHER_PLACEMENT_POINTS = 10;
