/** Game catalog metadata shared by client (library UI) and server (validation). */

export const GAME_IDS = [
  "speed-quiz",
  "impostor",
  "majority",
  "drawing",
  "word-scramble",
  "reflex-battle",
  // Coming soon: keep last in the library.
  "picture-reveal",
  "survey-showdown",
  "perfectly-hold",
  "number-rush",
  "cup-shuffle",
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
    // Host-adjustable in game options (default 24).
    maxPlayers: 100,
    durationMin: 8,
    playable: true,
  },
  impostor: {
    id: "impostor",
    name: "The Impostor",
    tagline: "One of you is lying",
    description: "Everyone gets the secret word — except the impostor. Give clues, vote, and unmask the faker.",
    category: "social",
    minPlayers: 3,
    // Host-adjustable in game options (default 12).
    maxPlayers: 24,
    durationMin: 12,
    playable: true,
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
    playable: true,
  },
  drawing: {
    id: "drawing",
    name: "Draw & Guess",
    tagline: "Sketch it, guess it",
    description: "Draw the prompt on your phone while everyone races to guess what it is on the big screen.",
    category: "creative",
    minPlayers: 3,
    // Host-adjustable in game options (default 12).
    maxPlayers: 24,
    durationMin: 15,
    playable: true,
  },
  "word-scramble": {
    id: "word-scramble",
    name: "Word Scramble",
    tagline: "Beat the clock",
    description: "Unscramble the letters. Beat the clock. Be the fastest! The quicker you crack the word, the more you score.",
    category: "word",
    minPlayers: 1,
    maxPlayers: 24,
    durationMin: 6,
    playable: true,
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
    playable: false,
  },
  "perfectly-hold": {
    id: "perfectly-hold",
    name: "Perfectly Hold",
    tagline: "Hold tight. Release right.",
    description: "Hold the button and let go the moment the meter hits the target zone. Closest release wins.",
    category: "action",
    minPlayers: 2,
    maxPlayers: 24,
    durationMin: 5,
    playable: false,
  },
  "number-rush": {
    id: "number-rush",
    name: "Number Rush",
    tagline: "Predict the move. Master the numbers!",
    description: "Higher or lower? Call the next number card before time runs out and build the longest streak.",
    category: "action",
    minPlayers: 1,
    maxPlayers: 24,
    durationMin: 6,
    playable: false,
  },
  "cup-shuffle": {
    id: "cup-shuffle",
    name: "Cup Shuffle",
    tagline: "Watch closely. Guess wisely.",
    description: "Keep your eyes on the ball as the cups shuffle on the big screen, then pick where it's hiding.",
    category: "action",
    minPlayers: 1,
    maxPlayers: 24,
    durationMin: 5,
    playable: false,
  },
};

export function isGameId(value: unknown): value is GameId {
  return typeof value === "string" && (GAME_IDS as readonly string[]).includes(value);
}
