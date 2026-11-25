/** Crypto-random codes and ids. */
import { randomInt } from "node:crypto";
import { PAIRING_CODE_LENGTH, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "../../../shared/constants";

const ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

function randomString(alphabet: string, length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[randomInt(alphabet.length)];
  return out;
}

/** Public player room code, e.g. "KPXW" (no look-alike characters). */
export function generateRoomCode(): string {
  return randomString(ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH);
}

/** Display pairing code: 6 digits, leading zeros allowed. */
export function generatePairingCode(): string {
  return randomString("0123456789", PAIRING_CODE_LENGTH);
}

/**
 * Short lowercase alphanumeric id. No "_" so it is safe inside composite
 * doc ids such as submissions/{entryId}_{round}_{uid}.
 */
export function generateId(length = 12): string {
  return randomString(ID_ALPHABET, length);
}
