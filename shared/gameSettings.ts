/**
 * Per-room game options the host can change in the lobby. Shared by the client (form) and
 * Cloud Functions (validation, game setup, join cap). Keep free of runtime dependencies.
 */
import { LIMITS } from "./constants";
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

/** Settings stored on the room, keyed by game. Only Speed Quiz has options so far. */
export interface GameSettingsMap {
  "speed-quiz"?: SpeedQuizSettings;
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
  if (upcomingGameId(room) === "speed-quiz") return speedQuizSettings(room.gameSettings?.["speed-quiz"]).maxPlayers;
  return LIMITS.maxPlayersPerRoom;
}

/** "10s per question", "No time limit". */
export function questionTimeLabel(seconds: QuestionSeconds): string {
  return seconds === 0 ? "No time limit" : `${seconds}s per question`;
}
