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
  roomNameMax: 30,
  nicknameMin: 1,
  nicknameMax: 12,
  /** Default room capacity (games without their own player limit). */
  maxPlayersPerRoom: 24,
  /** Highest player limit a host can set in game options. */
  maxPlayersHardCap: 100,
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

/**
 * Room names and nicknames: letters (any language, e.g. "Niño") and numbers, with a single space or
 * hyphen between words ("Year-end Party"). No other symbols or emoji. Lengths come from LIMITS.
 */
export const NAME_PATTERN = /^[\p{L}\p{N}]+(?:[ -][\p{L}\p{N}]+)*$/u;

/**
 * Clean a name as it's typed: drops symbols and emoji, keeps one space or hyphen between words
 * (a run like " - " becomes "-"), nothing leading, and cuts it to `max` characters (counted as
 * characters, not UTF-16 units). A trailing space or hyphen is kept so the next word can be
 * typed; pass the result through `finishName` before submitting.
 */
export function cleanName(raw: string, max: number): string {
  const cleaned = raw
    .normalize("NFC")
    .replace(/[^\p{L}\p{N} -]/gu, "")
    .replace(/[ -]*-[ -]*/g, "-")
    .replace(/ {2,}/g, " ")
    .replace(/^[ -]+/, "");
  return [...cleaned].slice(0, max).join("");
}

/** A typed name ready to submit: no trailing space or hyphen. */
export function finishName(name: string): string {
  return name.replace(/[ -]+$/, "");
}
