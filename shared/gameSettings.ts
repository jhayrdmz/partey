/**
 * Per-room game options the host can change in the lobby. Shared by the client (form) and
 * Cloud Functions (validation, game setup, join cap). Keep free of runtime dependencies.
 */
import { LIMITS } from "./constants";
import { DRAW_CATEGORIES, IMPOSTOR_CATEGORIES, type DrawCategory, type ImpostorCategory } from "./engine";
import type { GameId } from "./games";
import type { GameMode, LineupEntry } from "./types";

/** Seconds per question; 0 = no limit (the question ends when everyone has answered, or when the host ends it). */
export const QUESTION_SECONDS_OPTIONS = [10, 15, 30, 0] as const;
export type QuestionSeconds = (typeof QUESTION_SECONDS_OPTIONS)[number];

export interface SpeedQuizSettings {
  questionSeconds: QuestionSeconds;
  /** New players can't join while Speed Quiz is the selected/next game and the room has this many. */
  maxPlayers: number;
  /** Number of questions. */
  rounds: number;
}

export const SPEED_QUIZ_LIMITS = {
  questionSeconds: { default: 10 as QuestionSeconds },
  maxPlayers: { min: 1, max: LIMITS.maxPlayersHardCap, default: LIMITS.maxPlayersPerRoom },
  rounds: { min: 8, max: 20, default: 8 },
} as const;

export const DEFAULT_SPEED_QUIZ_SETTINGS: SpeedQuizSettings = {
  questionSeconds: SPEED_QUIZ_LIMITS.questionSeconds.default,
  maxPlayers: SPEED_QUIZ_LIMITS.maxPlayers.default,
  rounds: SPEED_QUIZ_LIMITS.rounds.default,
};

/* ─── The Impostor ─────────────────────────────────────────────────────── */

export const IMPOSTOR_CATEGORY_OPTIONS = ["random", ...IMPOSTOR_CATEGORIES] as const;
export type ImpostorCategoryOption = (typeof IMPOSTOR_CATEGORY_OPTIONS)[number];

export interface ImpostorSettings {
  /** How many impostors (checked against the player count when the game starts). */
  impostors: number;
  category: ImpostorCategoryOption;
  /** How many times everyone gives a clue before the vote. */
  clueRounds: number;
  /** New players can't join while The Impostor is the selected/next game and the room has this many. */
  maxPlayers: number;
  /**
   * The host typed their own secret word. Only this flag is on the room (which players can read);
   * the word itself is in the host-only `rooms/{id}/hostSecrets/impostor` doc. Needs a real category.
   * Single-use: starting The Impostor turns this off and deletes the stored word.
   */
  customWord: boolean;
}

/** rooms/{id}/hostSecrets/impostor: readable by the host only, written by the server. */
export interface ImpostorHostSecret {
  word: string;
}

export const IMPOSTOR_LIMITS = {
  impostors: { min: 1, max: 3, default: 1 },
  clueRounds: { min: 1, max: 3, default: 1 },
  maxPlayers: { min: 3, max: 24, default: 12 },
  /** Custom secret word length (characters, spaces included). */
  customWord: { min: 2, max: 30 },
  /** A clue: one word, up to this many characters. */
  clue: { max: 24 },
  /** Fewest players the game can start with. */
  minPlayers: 3,
} as const;

export const DEFAULT_IMPOSTOR_SETTINGS: ImpostorSettings = {
  impostors: IMPOSTOR_LIMITS.impostors.default,
  category: "random",
  clueRounds: IMPOSTOR_LIMITS.clueRounds.default,
  maxPlayers: IMPOSTOR_LIMITS.maxPlayers.default,
  customWord: false,
};

export function impostorSettings(stored?: Partial<ImpostorSettings> | null): ImpostorSettings {
  return { ...DEFAULT_IMPOSTOR_SETTINGS, ...stored };
}

/** Most impostors allowed for a player count: they must stay a minority (3–4 players: 1, 5–6: 2…). */
export function maxImpostorsFor(players: number): number {
  return Math.max(1, Math.min(IMPOSTOR_LIMITS.impostors.max, Math.floor((players - 1) / 2)));
}

export const IMPOSTOR_CATEGORY_LABELS: Record<ImpostorCategoryOption, string> = {
  random: "Random",
  food: "Food",
  animals: "Animals",
  places: "Places",
  objects: "Objects",
  movies: "Movies",
};

export function categoryLabel(category: ImpostorCategory | ImpostorCategoryOption): string {
  return IMPOSTOR_CATEGORY_LABELS[category];
}

/* ─── Draw & Guess ─────────────────────────────────────────────────────── */

/** Seconds the artist gets to draw. */
export const DRAW_SECONDS_OPTIONS = [45, 60, 80, 100, 120] as const;
export type DrawSeconds = (typeof DRAW_SECONDS_OPTIONS)[number];

/** Reveal a letter of the prompt every N seconds while drawing; 0 = no hints. */
export const HINT_SECONDS_OPTIONS = [0, 10, 15, 20, 30] as const;
export type HintSeconds = (typeof HINT_SECONDS_OPTIONS)[number];

export interface DrawingSettings {
  /** Drawing turns in the game (artists rotate so everyone draws before anyone draws twice). */
  rounds: number;
  drawSeconds: DrawSeconds;
  /** A letter hint every this many seconds (0 = off). Never reveals more than a third of the letters. */
  hintSeconds: HintSeconds;
  /** Prompts come from these categories (at least one). */
  categories: DrawCategory[];
  /** New players can't join while Draw & Guess is the selected/next game and the room has this many. */
  maxPlayers: number;
}

export const DRAWING_LIMITS = {
  rounds: { min: 2, max: 20, default: 6 },
  drawSeconds: { default: 80 as DrawSeconds },
  hintSeconds: { default: 20 as HintSeconds },
  maxPlayers: { min: 3, max: 24, default: 12 },
  minPlayers: 3,
} as const;

export const DEFAULT_DRAWING_SETTINGS: DrawingSettings = {
  rounds: DRAWING_LIMITS.rounds.default,
  drawSeconds: DRAWING_LIMITS.drawSeconds.default,
  hintSeconds: DRAWING_LIMITS.hintSeconds.default,
  categories: [...DRAW_CATEGORIES],
  maxPlayers: DRAWING_LIMITS.maxPlayers.default,
};

export function drawingSettings(stored?: Partial<DrawingSettings> | null): DrawingSettings {
  const merged = { ...DEFAULT_DRAWING_SETTINGS, ...stored };
  // Never end up with no prompts (e.g. a category removed in a later version).
  const categories = merged.categories.filter((c) => (DRAW_CATEGORIES as readonly string[]).includes(c));
  return { ...merged, categories: categories.length ? categories : [...DRAW_CATEGORIES] };
}

export const DRAW_CATEGORY_LABELS: Record<DrawCategory, string> = {
  animals: "Animals",
  food: "Food & Drinks",
  objects: "Everyday Objects",
  places: "Places",
  movies: "Movies & Entertainment",
  sports: "Sports",
  school: "School & Education",
  filipino: "Filipino Culture",
};

/** Settings stored on the room, keyed by game. */
export interface GameSettingsMap {
  "speed-quiz"?: SpeedQuizSettings;
  impostor?: ImpostorSettings;
  drawing?: DrawingSettings;
}

/** Settings with defaults filled in (rooms created before options existed have none). */
export function speedQuizSettings(stored?: Partial<SpeedQuizSettings> | null): SpeedQuizSettings {
  return { ...DEFAULT_SPEED_QUIZ_SETTINGS, ...stored };
}

export function isWholeIn(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

/** The game players are about to play: the selected freestyle game or the tournament's next one. */
export function upcomingGameId(room: { gameMode: GameMode | null; lineup: LineupEntry[]; currentGameIndex: number }): GameId | null {
  return room.lineup[room.gameMode === "tournament" ? room.currentGameIndex : 0]?.gameId ?? null;
}

/** How many players may be in the room before new joins are refused. */
export function roomPlayerCap(room: {
  gameMode: GameMode | null;
  lineup: LineupEntry[];
  currentGameIndex: number;
  gameSettings?: GameSettingsMap | null;
}): number {
  const upcoming = upcomingGameId(room);
  if (upcoming === "speed-quiz") return speedQuizSettings(room.gameSettings?.["speed-quiz"]).maxPlayers;
  if (upcoming === "impostor") return impostorSettings(room.gameSettings?.impostor).maxPlayers;
  if (upcoming === "drawing") return drawingSettings(room.gameSettings?.drawing).maxPlayers;
  return LIMITS.maxPlayersPerRoom;
}

/** "10s per question", "No time limit". */
export function questionTimeLabel(seconds: QuestionSeconds): string {
  return seconds === 0 ? "No time limit" : `${seconds}s per question`;
}
