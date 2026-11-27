/** Input validation for callable payloads. Every failure is an "invalid-argument" with a user-facing message. */
import { AVATAR_IDS } from "../../../shared/avatars";
import { LIMITS, NAME_PATTERN, PAIRING_CODE_LENGTH, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "../../../shared/constants";
import { GAME_IDS, type GameId } from "../../../shared/games";
import { AUTHOR_CATEGORY_OPTIONS, AUTHOR_GUESS_SECONDS_OPTIONS, AUTHOR_LIMITS, AUTHOR_WRITE_SECONDS_OPTIONS, type AuthorSettings, RUSH_LIMITS, RUSH_SECONDS_OPTIONS, type RushSettings, CUP_LIMITS, type CupSettings, HOLD_LIMITS, HOLD_RANGE_OPTIONS, type HoldSettings, DRAWING_LIMITS, DRAW_SECONDS_OPTIONS, HINT_SECONDS_OPTIONS, SCRAMBLE_CATEGORY_OPTIONS, SCRAMBLE_DIFFICULTY_OPTIONS, SCRAMBLE_LIMITS, SCRAMBLE_SECONDS_OPTIONS, type ScrambleSettings, IMPOSTOR_CATEGORY_OPTIONS, IMPOSTOR_LIMITS, QUESTION_SECONDS_OPTIONS, SPEED_QUIZ_LIMITS, isWholeIn, type DrawingSettings, type ImpostorSettings, type SpeedQuizSettings } from "../../../shared/gameSettings";
import { DRAW_CATEGORIES, type DrawCategory } from "../../../shared/engine";
import type { GameMode } from "../../../shared/types";
import { fail } from "./errors";

type Data = Record<string, unknown>;

export function asObject(data: unknown): Data {
  if (typeof data !== "object" || data === null || Array.isArray(data)) fail("invalid-argument", "Invalid request.");
  return data as Data;
}

/**
 * Refuse a raw string far longer than any valid value before cleaning or matching it, so a huge
 * payload costs nothing. Generous: room for spaces and invisible characters that get stripped.
 */
export function capRaw(raw: string, max: number, label: string): void {
  if (raw.length > max * 4 + 32) fail("invalid-argument", `${label} must be at most ${max} characters.`);
}

/** Strip control and invisible characters, collapse whitespace, trim. */
export function cleanText(raw: string): string {
  return raw.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g, "").replace(/\s+/g, " ").trim();
}

/** Trimmed, whitespace-collapsed text with no control characters. Length counts characters, not UTF-16 units. */
export function text(data: Data, key: string, min: number, max: number, label: string): string {
  const raw = data[key];
  if (typeof raw !== "string") fail("invalid-argument", `${label} is required.`);
  capRaw(raw, max, label);
  const value = cleanText(raw);
  const length = [...value].length;
  if (length < min) fail("invalid-argument", min <= 1 ? `${label} is required.` : `${label} must be at least ${min} characters.`);
  if (length > max) fail("invalid-argument", `${label} must be at most ${max} characters.`);
  return value;
}

/** A room name or nickname: `text` rules plus letters and numbers only (single spaces between words). */
export function name(data: Data, key: string, min: number, max: number, label: string): string {
  const value = text(data, key, min, max, label).normalize("NFC");
  if (!NAME_PATTERN.test(value)) fail("invalid-argument", `${label} can only use letters and numbers (with a space or hyphen between words).`);
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
  const code = typeof raw === "string" && raw.length <= 32 ? raw.replace(/\s+/g, "").toUpperCase() : "";
  if (code.length !== ROOM_CODE_LENGTH || [...code].some((c) => !ROOM_CODE_ALPHABET.includes(c))) {
    fail("invalid-argument", `Room codes are ${ROOM_CODE_LENGTH} letters. Check the code on the big screen.`);
  }
  return code;
}

/** Display pairing code; digits only, ignores spaces and dashes. */
export function pairingCode(data: Data): string {
  const raw = data.code;
  const code = typeof raw === "string" && raw.length <= 32 ? raw.replace(/[\s-]/g, "") : "";
  if (!new RegExp(`^\\d{${PAIRING_CODE_LENGTH}}$`).test(code)) fail("invalid-argument", `Enter the ${PAIRING_CODE_LENGTH}-digit code shown on the host's screen.`);
  return code;
}

export function avatar(data: Data): string {
  const value = data.avatar;
  if (typeof value !== "string" || !AVATAR_IDS.includes(value)) fail("invalid-argument", "Pick an avatar.");
  return value;
}

/** Speed Quiz options from the lobby form. Every field is required. */
export function speedQuizSettings(value: unknown): SpeedQuizSettings {
  const data = asObject(value);
  const { questionSeconds, maxPlayers, rounds } = data;
  if (!(QUESTION_SECONDS_OPTIONS as readonly unknown[]).includes(questionSeconds)) fail("invalid-argument", "Pick 10s, 15s, 30s or no time limit.");
  const { maxPlayers: mp, rounds: r } = SPEED_QUIZ_LIMITS;
  if (!isWholeIn(maxPlayers, mp.min, mp.max)) fail("invalid-argument", `Max players must be between ${mp.min} and ${mp.max}.`);
  if (!isWholeIn(rounds, r.min, r.max)) fail("invalid-argument", `Questions must be between ${r.min} and ${r.max}.`);
  return { questionSeconds: questionSeconds as SpeedQuizSettings["questionSeconds"], maxPlayers, rounds };
}

/** The Impostor options from the lobby form. Every field is required. */
export function impostorSettings(value: unknown): ImpostorSettings {
  const data = asObject(value);
  const { impostors, category, clueRounds, maxPlayers } = data;
  const customWord = data.customWord ?? false;
  const L = IMPOSTOR_LIMITS;
  if (!isWholeIn(impostors, L.impostors.min, L.impostors.max)) fail("invalid-argument", `Impostors must be between ${L.impostors.min} and ${L.impostors.max}.`);
  if (!(IMPOSTOR_CATEGORY_OPTIONS as readonly unknown[]).includes(category)) fail("invalid-argument", "Pick a category.");
  if (!isWholeIn(clueRounds, L.clueRounds.min, L.clueRounds.max)) fail("invalid-argument", `Clue rounds must be between ${L.clueRounds.min} and ${L.clueRounds.max}.`);
  if (!isWholeIn(maxPlayers, L.maxPlayers.min, L.maxPlayers.max)) fail("invalid-argument", `Max players must be between ${L.maxPlayers.min} and ${L.maxPlayers.max}.`);
  if (typeof customWord !== "boolean") fail("invalid-argument", "Invalid word option.");
  // The impostor's only hint is the category, so a custom word needs a real one.
  if (customWord && category === "random") fail("invalid-argument", "Pick the category your word fits, so the impostor gets a fair hint.");
  return { impostors, category: category as ImpostorSettings["category"], clueRounds, maxPlayers, customWord };
}

/** The host's own secret word for The Impostor: letters and numbers, single spaces, ' and - inside. */
export function impostorCustomWord(data: Data): string {
  const { min, max } = IMPOSTOR_LIMITS.customWord;
  const word = text(data, "customWord", min, max, "Custom word");
  if (!/^[\p{L}\p{N}]+(?:[ '’-][\p{L}\p{N}]+)*$/u.test(word)) fail("invalid-argument", "Use letters and numbers only (spaces, ' and - are fine between them).");
  return word;
}

/** Draw & Guess options from the lobby form. Every field is required. */
export function drawingSettings(value: unknown): DrawingSettings {
  const data = asObject(value);
  const { rounds, drawSeconds, categories, maxPlayers } = data;
  // Optional for clients from before hints existed.
  const hintSeconds = data.hintSeconds ?? DRAWING_LIMITS.hintSeconds.default;
  const L = DRAWING_LIMITS;
  if (!isWholeIn(rounds, L.rounds.min, L.rounds.max)) fail("invalid-argument", `Rounds must be between ${L.rounds.min} and ${L.rounds.max}.`);
  if (!(DRAW_SECONDS_OPTIONS as readonly unknown[]).includes(drawSeconds)) fail("invalid-argument", `Pick a drawing time: ${DRAW_SECONDS_OPTIONS.join(", ")} seconds.`);
  if (!(HINT_SECONDS_OPTIONS as readonly unknown[]).includes(hintSeconds)) fail("invalid-argument", `Pick letter hints: off or every ${HINT_SECONDS_OPTIONS.filter(Boolean).join(", ")} seconds.`);
  if (!Array.isArray(categories) || categories.length === 0) fail("invalid-argument", "Pick at least one category.");
  if (categories.length > DRAW_CATEGORIES.length) fail("invalid-argument", "Too many categories.");
  if (categories.some((c) => !(DRAW_CATEGORIES as readonly unknown[]).includes(c))) fail("invalid-argument", "Unknown category.");
  if (!isWholeIn(maxPlayers, L.maxPlayers.min, L.maxPlayers.max)) fail("invalid-argument", `Max players must be between ${L.maxPlayers.min} and ${L.maxPlayers.max}.`);
  // Stored in the catalog's order, without duplicates.
  const chosen = DRAW_CATEGORIES.filter((c) => (categories as unknown[]).includes(c)) as DrawCategory[];
  return { rounds, drawSeconds: drawSeconds as DrawingSettings["drawSeconds"], hintSeconds: hintSeconds as DrawingSettings["hintSeconds"], categories: chosen, maxPlayers };
}

/** Word Scramble options from the lobby form. Every field is required. */
export function scrambleSettings(value: unknown): ScrambleSettings {
  const data = asObject(value);
  const { rounds, roundSeconds, difficulty, category, hints, speedBonus, maxPlayers } = data;
  const L = SCRAMBLE_LIMITS;
  if (!isWholeIn(rounds, L.rounds.min, L.rounds.max)) fail("invalid-argument", `Rounds must be between ${L.rounds.min} and ${L.rounds.max}.`);
  if (!(SCRAMBLE_SECONDS_OPTIONS as readonly unknown[]).includes(roundSeconds)) fail("invalid-argument", `Pick a round time: ${SCRAMBLE_SECONDS_OPTIONS.join(", ")} seconds.`);
  if (!(SCRAMBLE_DIFFICULTY_OPTIONS as readonly unknown[]).includes(difficulty)) fail("invalid-argument", "Pick a difficulty.");
  if (!(SCRAMBLE_CATEGORY_OPTIONS as readonly unknown[]).includes(category)) fail("invalid-argument", "Pick a category.");
  if (typeof hints !== "boolean" || typeof speedBonus !== "boolean") fail("invalid-argument", "Invalid hint or speed bonus option.");
  if (!isWholeIn(maxPlayers, L.maxPlayers.min, L.maxPlayers.max)) fail("invalid-argument", `Max players must be between ${L.maxPlayers.min} and ${L.maxPlayers.max}.`);
  return {
    rounds,
    roundSeconds: roundSeconds as ScrambleSettings["roundSeconds"],
    difficulty: difficulty as ScrambleSettings["difficulty"],
    category: category as ScrambleSettings["category"],
    hints,
    speedBonus,
    maxPlayers,
  };
}

/** Perfectly Hold options from the lobby form. Every field is required. */
export function holdSettings(value: unknown): HoldSettings {
  const { rounds, range, maxPlayers } = asObject(value);
  const L = HOLD_LIMITS;
  if (!isWholeIn(rounds, L.rounds.min, L.rounds.max)) fail("invalid-argument", `Rounds must be between ${L.rounds.min} and ${L.rounds.max}.`);
  if (!(HOLD_RANGE_OPTIONS as readonly unknown[]).includes(range)) fail("invalid-argument", "Pick a target range.");
  if (!isWholeIn(maxPlayers, L.maxPlayers.min, L.maxPlayers.max)) fail("invalid-argument", `Max players must be between ${L.maxPlayers.min} and ${L.maxPlayers.max}.`);
  return { rounds, range: range as HoldSettings["range"], maxPlayers };
}

/** Cup Shuffle options from the lobby form. Every field is required. */
export function cupSettings(value: unknown): CupSettings {
  const { rounds, maxPlayers } = asObject(value);
  const L = CUP_LIMITS;
  if (!isWholeIn(rounds, L.rounds.min, L.rounds.max)) fail("invalid-argument", `Rounds must be between ${L.rounds.min} and ${L.rounds.max}.`);
  if (!isWholeIn(maxPlayers, L.maxPlayers.min, L.maxPlayers.max)) fail("invalid-argument", `Max players must be between ${L.maxPlayers.min} and ${L.maxPlayers.max}.`);
  return { rounds, maxPlayers };
}

/** Number Rush options from the lobby form. Every field is required. */
export function rushSettings(value: unknown): RushSettings {
  const { rounds, seconds, maxPlayers } = asObject(value);
  const L = RUSH_LIMITS;
  if (!isWholeIn(rounds, L.rounds.min, L.rounds.max)) fail("invalid-argument", `Rounds must be between ${L.rounds.min} and ${L.rounds.max}.`);
  if (!(RUSH_SECONDS_OPTIONS as readonly unknown[]).includes(seconds)) fail("invalid-argument", "Pick a time per round.");
  if (!isWholeIn(maxPlayers, L.maxPlayers.min, L.maxPlayers.max)) fail("invalid-argument", `Max players must be between ${L.maxPlayers.min} and ${L.maxPlayers.max}.`);
  return { rounds, seconds: seconds as RushSettings["seconds"], maxPlayers };
}

/** The Author options from the lobby form. Every field is required. */
export function authorSettings(value: unknown): AuthorSettings {
  const { rounds, category, writeSeconds, guessSeconds, maxPlayers } = asObject(value);
  const L = AUTHOR_LIMITS;
  if (!isWholeIn(rounds, L.rounds.min, L.rounds.max)) fail("invalid-argument", `Rounds must be between ${L.rounds.min} and ${L.rounds.max}.`);
  if (!(AUTHOR_CATEGORY_OPTIONS as readonly unknown[]).includes(category)) fail("invalid-argument", "Pick a category.");
  if (!(AUTHOR_WRITE_SECONDS_OPTIONS as readonly unknown[]).includes(writeSeconds)) fail("invalid-argument", "Pick a writing time.");
  if (!(AUTHOR_GUESS_SECONDS_OPTIONS as readonly unknown[]).includes(guessSeconds)) fail("invalid-argument", "Pick a guessing time.");
  if (!isWholeIn(maxPlayers, L.maxPlayers.min, L.maxPlayers.max)) fail("invalid-argument", `Max players must be between ${L.maxPlayers.min} and ${L.maxPlayers.max}.`);
  return {
    rounds,
    category: category as AuthorSettings["category"],
    writeSeconds: writeSeconds as AuthorSettings["writeSeconds"],
    guessSeconds: guessSeconds as AuthorSettings["guessSeconds"],
    maxPlayers,
  };
}
