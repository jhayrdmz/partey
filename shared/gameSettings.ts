/**
 * Per-room game options the host can change in the lobby. Shared by the client (form) and
 * Cloud Functions (validation, game setup, join cap). Keep free of runtime dependencies.
 */
import { LIMITS } from "./constants";
import { DRAW_CATEGORIES, IMPOSTOR_CATEGORIES, SCRAMBLE_CATEGORIES, type AuthorCategory, type DrawCategory, type ImpostorCategory } from "./engine";
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

/* ─── Word Scramble ────────────────────────────────────────────────────── */

export const SCRAMBLE_ROUND_PRESETS = [5, 10, 15] as const;
export const SCRAMBLE_SECONDS_OPTIONS = [15, 20, 30, 45] as const;
export type ScrambleSeconds = (typeof SCRAMBLE_SECONDS_OPTIONS)[number];
export const SCRAMBLE_DIFFICULTY_OPTIONS = ["easy", "medium", "hard", "mixed"] as const;
export type ScrambleDifficultyOption = (typeof SCRAMBLE_DIFFICULTY_OPTIONS)[number];
export const SCRAMBLE_CATEGORY_OPTIONS = ["random", ...SCRAMBLE_CATEGORIES] as const;
export type ScrambleCategoryOption = (typeof SCRAMBLE_CATEGORY_OPTIONS)[number];

export interface ScrambleSettings {
  /** Words in the game: 5, 10, 15 or a custom number. */
  rounds: number;
  roundSeconds: ScrambleSeconds;
  difficulty: ScrambleDifficultyOption;
  category: ScrambleCategoryOption;
  /** Reveal the first letter halfway through, and the last with a quarter of the time left. */
  hints: boolean;
  /** Up to SCRAMBLE_POINTS.speedBonusMax extra for answering early. */
  speedBonus: boolean;
  /** New players can't join while Word Scramble is the selected/next game and the room has this many. */
  maxPlayers: number;
}

export const SCRAMBLE_LIMITS = {
  rounds: { min: 3, max: 30, default: 10 },
  roundSeconds: { default: 30 as ScrambleSeconds },
  maxPlayers: { min: 1, max: 24, default: 24 },
  /** Fixed: one guess every 5 seconds per player (enforced by the server). */
  cooldownMs: 5_000,
  /** Longest guess accepted. */
  guessMax: 24,
} as const;

/** Points by correct-answer order (1st, 2nd, 3rd, then everyone after), plus the optional speed bonus. */
export const SCRAMBLE_POINTS = {
  byOrder: [100, 75, 50],
  rest: 25,
  /** With speed bonus on: up to this many extra, in proportion to the time left. */
  speedBonusMax: 50,
} as const;

export const DEFAULT_SCRAMBLE_SETTINGS: ScrambleSettings = {
  rounds: SCRAMBLE_LIMITS.rounds.default,
  roundSeconds: SCRAMBLE_LIMITS.roundSeconds.default,
  difficulty: "mixed",
  category: "random",
  hints: true,
  speedBonus: false,
  maxPlayers: SCRAMBLE_LIMITS.maxPlayers.default,
};

export function scrambleSettings(stored?: Partial<ScrambleSettings> | null): ScrambleSettings {
  return { ...DEFAULT_SCRAMBLE_SETTINGS, ...stored };
}

export const SCRAMBLE_CATEGORY_LABELS: Record<ScrambleCategoryOption, string> = {
  random: "Random",
  general: "General Vocabulary",
  animals: "Animals",
  food: "Food",
  technology: "Technology",
  geography: "Geography",
  science: "Science",
  sports: "Sports",
  entertainment: "Entertainment",
};

export const SCRAMBLE_DIFFICULTY_LABELS: Record<ScrambleDifficultyOption, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  mixed: "Mixed",
};

/** Points for the n-th correct answer (0-based), before any speed bonus. */
export function scramblePoints(order: number): number {
  return SCRAMBLE_POINTS.byOrder[order] ?? SCRAMBLE_POINTS.rest;
}

/** Speed bonus: up to SCRAMBLE_POINTS.speedBonusMax, in proportion to the time left. Same on server and phones. */
export function scrambleSpeedBonus(elapsedMs: number, durationMs: number): number {
  const left = Math.max(0, Math.min(1, 1 - elapsedMs / Math.max(1, durationMs)));
  return Math.round(SCRAMBLE_POINTS.speedBonusMax * left);
}

/* ─── Perfectly Hold ───────────────────────────────────────────────────── */

export const HOLD_ROUND_PRESETS = [3, 5, 8, 10] as const;
export const HOLD_RANGE_OPTIONS = ["short", "medium", "long", "mixed"] as const;
export type HoldRange = (typeof HOLD_RANGE_OPTIONS)[number];

/** Target durations per range, whole seconds (inclusive). */
export const HOLD_RANGES: Record<HoldRange, { min: number; max: number }> = {
  short: { min: 5, max: 8 },
  medium: { min: 8, max: 12 },
  long: { min: 12, max: 15 },
  mixed: { min: 5, max: 15 },
};

export const HOLD_RANGE_LABELS: Record<HoldRange, string> = { short: "Short", medium: "Medium", long: "Long", mixed: "Mixed" };

export interface HoldSettings {
  rounds: number;
  /** Each round's target is a random whole number of seconds in this range. */
  range: HoldRange;
  /** New players can't join while Perfectly Hold is the selected/next game and the room has this many. */
  maxPlayers: number;
}

export const HOLD_LIMITS = {
  rounds: { min: 1, max: 15, default: 5 },
  maxPlayers: { min: 2, max: 24, default: 24 },
  /** The big screen shows the target this long before the countdown. */
  announceMs: 2_500,
  /** 3, 2, 1, then GO. */
  countdownMs: 3_000,
  /** After GO, this long to press. */
  pressWindowMs: 5_000,
  /** A hold can run this far past the target; then the phone lets go by itself. */
  overtimeMs: 10_000,
  /** Holds are rounded to this (hundredths of a second, as shown on the results). */
  precisionMs: 10,
  /** Shorter holds are taken as a slip and rejected. */
  minHoldMs: 100,
  /** Allowance for device clock drift when checking a hold couldn't have started before GO. */
  skewMs: 1_500,
} as const;

/** Points by closeness rank (ties share a rank), then everyone else who held. No hold: 0. */
export const HOLD_POINTS = { byRank: [100, 75, 50], rest: 25 } as const;

export const DEFAULT_HOLD_SETTINGS: HoldSettings = { rounds: HOLD_LIMITS.rounds.default, range: "mixed", maxPlayers: HOLD_LIMITS.maxPlayers.default };

export function holdSettings(stored?: Partial<HoldSettings> | null): HoldSettings {
  return { ...DEFAULT_HOLD_SETTINGS, ...stored };
}

export function holdPoints(rank: number): number {
  return HOLD_POINTS.byRank[rank - 1] ?? HOLD_POINTS.rest;
}

export type HoldVerdict = "perfect" | "almost" | "good" | "early" | "late";

/** How close a hold was. Same labels on the big screen and the phone. */
export function holdVerdict(holdMs: number, targetMs: number): HoldVerdict {
  const diff = Math.abs(holdMs - targetMs);
  if (diff <= 100) return "perfect";
  if (diff <= 500) return "almost";
  if (diff <= 1_500) return "good";
  return holdMs < targetMs ? "early" : "late";
}

export const HOLD_VERDICT_LABELS: Record<HoldVerdict, string> = {
  perfect: "Perfect!",
  almost: "Almost there",
  good: "Good try",
  early: "Too early",
  late: "Too late",
};

/** 9.98s */
export function formatHold(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}

/* ─── Cup Shuffle ──────────────────────────────────────────────────────── */

export const CUP_ROUND_PRESETS = [3, 5, 8, 10] as const;

export interface CupSettings {
  rounds: number;
  /** New players can't join while Cup Shuffle is the selected/next game and the room has this many. */
  maxPlayers: number;
}

export const CUP_LIMITS = {
  rounds: { min: 1, max: 15, default: 5 },
  maxPlayers: { min: 1, max: 24, default: 24 },
  /** "Round x": the cups appear before the ball is shown. */
  announceMs: 1_500,
  /** The cup stays up this long showing the ball. */
  peekMs: 2_500,
  /** The cup is back down; a beat before the first swap. */
  settleMs: 700,
  /** After the last swap, before phones may pick. */
  stopMs: 400,
  /** Time to pick a cup. */
  guessMs: 10_000,
  /** Allowance for device clock drift on "the cups were still moving". */
  skewMs: 500,
  /**
   * One swap's duration. The shuffle speeds up once 30%, 60% and 80% of the game's rounds are done
   * (`from` = share of rounds played before this one).
   */
  speedTiers: [
    { from: 0, swapMs: 650 },
    { from: 0.3, swapMs: 500 },
    { from: 0.6, swapMs: 380 },
    { from: 0.8, swapMs: 280 },
  ],
} as const;

/** Right cup 100. A streak of right picks in a row adds 25 per round after the first (2nd +25, 3rd +50…), up to +100. */
export const CUP_POINTS = { correct: 100, streakStep: 25, streakMax: 100 } as const;

/** Bonus for the `streak`-th right pick in a row (1 = no bonus). */
export function cupStreakBonus(streak: number): number {
  return Math.min(CUP_POINTS.streakMax, CUP_POINTS.streakStep * Math.max(0, streak - 1));
}

export const DEFAULT_CUP_SETTINGS: CupSettings = { rounds: CUP_LIMITS.rounds.default, maxPlayers: CUP_LIMITS.maxPlayers.default };

export function cupSettings(stored?: Partial<CupSettings> | null): CupSettings {
  return { ...DEFAULT_CUP_SETTINGS, ...stored };
}

/** How many swaps round `round` (1-based) has: 3–5, 6–8, 9–11, 12–14, 15–17, then 18–20 and one more each round (max 30). */
export function cupSwapRange(round: number): { min: number; max: number } {
  if (round <= 5) return { min: 3 * round, max: 3 * round + 2 };
  const extra = Math.min(round - 6, 10);
  return { min: 18 + extra, max: 20 + extra };
}

/** Speed tier (0–3) for round `round` (1-based) of `totalRounds`. */
export function cupSpeedTier(round: number, totalRounds: number): number {
  const played = (round - 1) / Math.max(1, totalRounds);
  let tier = 0;
  CUP_LIMITS.speedTiers.forEach((t, i) => {
    if (played >= t.from - 1e-9) tier = i;
  });
  return tier;
}

export function cupSwapMs(round: number, totalRounds: number): number {
  return CUP_LIMITS.speedTiers[cupSpeedTier(round, totalRounds)].swapMs;
}

export const CUP_SLOT_LABELS = ["Left", "Middle", "Right"] as const;

/* ─── Number Rush ──────────────────────────────────────────────────────── */

export const RUSH_ROUND_PRESETS = [5, 10, 15, 20] as const;
export const RUSH_SECONDS_OPTIONS = [5, 8, 10, 15] as const;
export type RushSeconds = (typeof RUSH_SECONDS_OPTIONS)[number];

export interface RushSettings {
  rounds: number;
  /** Time to predict each round. */
  seconds: RushSeconds;
  /** New players can't join while Number Rush is the selected/next game and the room has this many. */
  maxPlayers: number;
}

export const RUSH_LIMITS = {
  rounds: { min: 1, max: 30, default: 10 },
  maxPlayers: { min: 1, max: 24, default: 24 },
  /** Numbers are always three digits. */
  min: 100,
  max: 999,
} as const;

/** Streak multipliers: right predictions in a row (this one included) → multiplier on 10 base points. */
export const RUSH_POINTS = {
  base: 10,
  tiers: [
    { from: 6, multiplier: 2 },
    { from: 4, multiplier: 1.5 },
    { from: 2, multiplier: 1.25 },
    { from: 1, multiplier: 1 },
  ],
} as const;

export const DEFAULT_RUSH_SETTINGS: RushSettings = { rounds: RUSH_LIMITS.rounds.default, seconds: 10, maxPlayers: RUSH_LIMITS.maxPlayers.default };

export function rushSettings(stored?: Partial<RushSettings> | null): RushSettings {
  return { ...DEFAULT_RUSH_SETTINGS, ...stored };
}

/** Multiplier for the `streak`-th right prediction in a row: 1x, 1.25x (2–3), 1.5x (4–5), 2x (6+). 0 = no streak. */
export function rushMultiplier(streak: number): number {
  if (streak < 1) return 0;
  return RUSH_POINTS.tiers.find((t) => streak >= t.from)!.multiplier;
}

/** Points for the `streak`-th right prediction in a row: 10, 13, 13, 15, 15, 20… (rounded). */
export function rushPoints(streak: number): number {
  return Math.round(RUSH_POINTS.base * rushMultiplier(streak));
}

/** Which predictions make sense for a number: nothing is above 999 or below 100. */
export function rushAllowed(current: number): { higher: boolean; lower: boolean } {
  return { higher: current < RUSH_LIMITS.max, lower: current > RUSH_LIMITS.min };
}

/* ─── The Author ───────────────────────────────────────────────────────── */

export const AUTHOR_CATEGORIES = ["funny", "embarrassing", "deep", "childhood", "relationships", "wildcard"] as const satisfies readonly AuthorCategory[];
export const AUTHOR_CATEGORY_OPTIONS = ["random", ...AUTHOR_CATEGORIES] as const;
export type AuthorCategoryOption = (typeof AUTHOR_CATEGORY_OPTIONS)[number];
export const AUTHOR_CATEGORY_LABELS: Record<AuthorCategoryOption, string> = {
  random: "Random",
  funny: "Funny",
  embarrassing: "Embarrassing",
  deep: "Deep",
  childhood: "Childhood",
  relationships: "Relationships",
  wildcard: "Wildcard",
};
export const AUTHOR_ROUND_PRESETS = [1, 2, 3] as const;
export const AUTHOR_WRITE_SECONDS_OPTIONS = [45, 60, 90, 120] as const;
export const AUTHOR_GUESS_SECONDS_OPTIONS = [15, 20, 30] as const;

export interface AuthorSettings {
  /** Rounds in the game: one question each, with one answer per player to guess. */
  rounds: number;
  /** One category, or "random" (each question from any category). */
  category: AuthorCategoryOption;
  writeSeconds: (typeof AUTHOR_WRITE_SECONDS_OPTIONS)[number];
  guessSeconds: (typeof AUTHOR_GUESS_SECONDS_OPTIONS)[number];
  /** New players can't join while The Author is the selected/next game and the room has this many. */
  maxPlayers: number;
}

export const AUTHOR_LIMITS = {
  rounds: { min: 1, max: 3, default: 3 },
  maxPlayers: { min: 3, max: 16, default: 16 },
  /** Characters per answer. */
  answerMax: 120,
} as const;

/** 100 per right guess, plus 50 for each right guess in a row before it: 100, 150, 200, 250… */
export const AUTHOR_POINTS = { base: 100, streakStep: 50 } as const;

export function authorBonus(streak: number): number {
  return AUTHOR_POINTS.streakStep * Math.max(0, streak - 1);
}

export const DEFAULT_AUTHOR_SETTINGS: AuthorSettings = {
  rounds: AUTHOR_LIMITS.rounds.default,
  category: "random",
  writeSeconds: 60,
  guessSeconds: 20,
  maxPlayers: AUTHOR_LIMITS.maxPlayers.default,
};

export function authorSettings(stored?: Partial<AuthorSettings> | null): AuthorSettings {
  return { ...DEFAULT_AUTHOR_SETTINGS, ...stored };
}

/** Settings stored on the room, keyed by game. */
export interface GameSettingsMap {
  "speed-quiz"?: SpeedQuizSettings;
  impostor?: ImpostorSettings;
  drawing?: DrawingSettings;
  "word-scramble"?: ScrambleSettings;
  "perfectly-hold"?: HoldSettings;
  "cup-shuffle"?: CupSettings;
  "number-rush"?: RushSettings;
  "the-author"?: AuthorSettings;
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
  if (upcoming === "word-scramble") return scrambleSettings(room.gameSettings?.["word-scramble"]).maxPlayers;
  if (upcoming === "perfectly-hold") return holdSettings(room.gameSettings?.["perfectly-hold"]).maxPlayers;
  if (upcoming === "cup-shuffle") return cupSettings(room.gameSettings?.["cup-shuffle"]).maxPlayers;
  if (upcoming === "number-rush") return rushSettings(room.gameSettings?.["number-rush"]).maxPlayers;
  if (upcoming === "the-author") return authorSettings(room.gameSettings?.["the-author"]).maxPlayers;
  return LIMITS.maxPlayersPerRoom;
}

/** "10s per question", "No time limit". */
export function questionTimeLabel(seconds: QuestionSeconds): string {
  return seconds === 0 ? "No time limit" : `${seconds}s per question`;
}
