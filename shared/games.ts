/** Game catalog metadata shared by client (library UI) and server (validation). */

export const GAME_IDS = [
  "speed-quiz",
  "impostor",
  "majority",
  "drawing",
  "word-scramble",
  "picture-reveal",
  "reflex-battle",
  "survey-showdown",
] as const;

export type GameId = (typeof GAME_IDS)[number];

export const GAME_CATEGORIES = ["trivia", "social", "creative", "word", "action"] as const;
export type GameCategory = (typeof GAME_CATEGORIES)[number];

export interface GameMeta {
  id: GameId;
  name: string;
  tagline: string;
  description: string;
  category: GameCategory;
  minPlayers: number;
  maxPlayers: number;
  /** Rough duration in minutes, for the host's planning. */
  durationMin: number;
  /** Highlighted in the library (first wave of mini-games). */
  featured: boolean;
  /** A game engine handler exists, so the game can be started. */
  playable: boolean;
}

export const GAMES: Record<GameId, GameMeta> = {
  "speed-quiz": {
    id: "speed-quiz",
    name: "Speed Quiz",
    tagline: "Fastest finger wins",
    description: "Rapid-fire trivia. Answer right and answer fast — speed bonuses decide the champion.",
    category: "trivia",
    minPlayers: 1,
    maxPlayers: 24,
    durationMin: 8,
    featured: true,
    playable: true,
  },
  impostor: {
    id: "impostor",
    name: "The Impostor",
    tagline: "One of you is lying",
    description: "Everyone gets the secret word — except the impostor. Give clues, vote, and unmask the faker.",
    category: "social",
    minPlayers: 4,
    maxPlayers: 12,
    durationMin: 12,
    featured: false,
    playable: false,
  },
  majority: {
    id: "majority",
    name: "Guess the Majority",
    tagline: "Think like the crowd",
    description: "No right answers — only popular ones. Score by picking what most of the room picks.",
    category: "social",
    minPlayers: 3,
    maxPlayers: 24,
    durationMin: 8,
    featured: true,
    playable: true,
  },
  drawing: {
    id: "drawing",
    name: "Draw & Guess",
    tagline: "Sketch it, guess it",
    description: "Draw the prompt on your phone while everyone races to guess what it is on the big screen.",
    category: "creative",
    minPlayers: 3,
    maxPlayers: 12,
    durationMin: 15,
    featured: false,
    playable: false,
  },
  "word-scramble": {
    id: "word-scramble",
    name: "Word Scramble",
    tagline: "Unjumble the letters",
    description: "Letters get shuffled on screen. Be the first to type the real word.",
    category: "word",
    minPlayers: 1,
    maxPlayers: 24,
    durationMin: 6,
    featured: false,
    playable: false,
  },
  "picture-reveal": {
    id: "picture-reveal",
    name: "Picture Reveal",
    tagline: "What's behind the tiles?",
    description: "A hidden picture is uncovered piece by piece. Guess early for big points.",
    category: "trivia",
    minPlayers: 1,
    maxPlayers: 24,
    durationMin: 8,
    featured: false,
    playable: false,
  },
  "reflex-battle": {
    id: "reflex-battle",
    name: "Reflex Battle",
    tagline: "Wait for it… TAP!",
    description: "Tap the instant the screen says go. Too early and you're out. Pure reaction speed.",
    category: "action",
    minPlayers: 2,
    maxPlayers: 24,
    durationMin: 5,
    featured: true,
    playable: true,
  },
  "survey-showdown": {
    id: "survey-showdown",
    name: "Survey Showdown",
    tagline: "Name the top answers",
    description: "We asked 100 people… Guess the most popular survey answers to climb the board.",
    category: "trivia",
    minPlayers: 2,
    maxPlayers: 24,
    durationMin: 10,
    featured: false,
    playable: false,
  },
};

export function isGameId(value: unknown): value is GameId {
  return typeof value === "string" && (GAME_IDS as readonly string[]).includes(value);
}
