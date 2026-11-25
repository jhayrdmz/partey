/** Input validation for callable payloads. Every failure is an "invalid-argument" with a user-facing message. */
import { AVATAR_IDS } from "../../../shared/avatars";
import { LIMITS, PAIRING_CODE_LENGTH, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "../../../shared/constants";
import { GAME_IDS, type GameId } from "../../../shared/games";
import type { GameMode } from "../../../shared/types";
import { fail } from "./errors";

type Data = Record<string, unknown>;

export function asObject(data: unknown): Data {
  if (typeof data !== "object" || data === null || Array.isArray(data)) fail("invalid-argument", "Invalid request.");
  return data as Data;
}

/** Trimmed, whitespace-collapsed text with no control characters. Length counts characters, not UTF-16 units. */
export function text(data: Data, key: string, min: number, max: number, label: string): string {
  const raw = data[key];
  if (typeof raw !== "string") fail("invalid-argument", `${label} is required.`);
  const value = raw.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g, "").replace(/\s+/g, " ").trim();
  const length = [...value].length;
  if (length < min) fail("invalid-argument", min <= 1 ? `${label} is required.` : `${label} must be at least ${min} characters.`);
  if (length > max) fail("invalid-argument", `${label} must be at most ${max} characters.`);
  return value;
}

/** Firestore doc id / auth uid. Same charset the RTDB presence rules accept. */
export function docId(data: Data, key: string): string {
  const value = data[key];
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) fail("invalid-argument", `Invalid ${key}.`);
  return value;
}

export function bool(data: Data, key: string): boolean {
  const value = data[key];
  if (typeof value !== "boolean") fail("invalid-argument", `Invalid ${key}.`);
  return value;
}

export function gameMode(data: Data): GameMode {
  const value = data.gameMode;
  if (value !== "tournament" && value !== "freestyle") fail("invalid-argument", "Pick tournament or freestyle.");
  return value;
}

export function gameId(value: unknown): GameId {
  if (typeof value !== "string" || !(GAME_IDS as readonly string[]).includes(value)) fail("invalid-argument", "Unknown game.");
  return value as GameId;
}

/** Ordered game ids for the lineup (may be empty to clear it). Playability is checked at start. */
export function lineup(data: Data): GameId[] {
  const value = data.lineup;
  if (!Array.isArray(value)) fail("invalid-argument", "Invalid lineup.");
  if (value.length > LIMITS.maxLineupLength) fail("invalid-argument", `A lineup can have at most ${LIMITS.maxLineupLength} games.`);
  return value.map(gameId);
}

/** Player room code; case-insensitive, ignores spaces. */
export function roomCode(data: Data): string {
  const raw = data.roomCode;
  const code = typeof raw === "string" ? raw.replace(/\s+/g, "").toUpperCase() : "";
  if (code.length !== ROOM_CODE_LENGTH || [...code].some((c) => !ROOM_CODE_ALPHABET.includes(c))) {
    fail("invalid-argument", `Room codes are ${ROOM_CODE_LENGTH} letters. Check the code on the big screen.`);
  }
  return code;
}

/** Display pairing code; digits only, ignores spaces and dashes. */
export function pairingCode(data: Data): string {
  const raw = data.code;
  const code = typeof raw === "string" ? raw.replace(/[\s-]/g, "") : "";
  if (!new RegExp(`^\\d{${PAIRING_CODE_LENGTH}}$`).test(code)) fail("invalid-argument", `Enter the ${PAIRING_CODE_LENGTH}-digit code shown on the host's screen.`);
  return code;
}

export function avatar(data: Data): string {
  const value = data.avatar;
  if (typeof value !== "string" || !AVATAR_IDS.includes(value)) fail("invalid-argument", "Pick an avatar.");
  return value;
}
