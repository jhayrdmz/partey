import { GAME_IDS, type GameId } from "@shared/games";
import type { GameModule } from "./types";
import { module as speedQuiz } from "./speed-quiz";
import { module as impostor } from "./impostor";
import { module as majority } from "./majority";
import { module as drawing } from "./drawing";
import { module as wordScramble } from "./word-scramble";
import { module as pictureReveal } from "./picture-reveal";
import { module as reflexBattle } from "./reflex-battle";
import { module as surveyShowdown } from "./survey-showdown";
import { module as perfectlyHold } from "./perfectly-hold";
import { module as numberRush } from "./number-rush";
import { module as cupShuffle } from "./cup-shuffle";
import { module as beerPressure } from "./beer-pressure";
import { module as theAuthor } from "./the-author";

export const GAME_MODULES: Record<GameId, GameModule> = {
  "speed-quiz": speedQuiz,
  impostor,
  majority,
  drawing,
  "word-scramble": wordScramble,
  "picture-reveal": pictureReveal,
  "reflex-battle": reflexBattle,
  "survey-showdown": surveyShowdown,
  "perfectly-hold": perfectlyHold,
  "number-rush": numberRush,
  "cup-shuffle": cupShuffle,
  "beer-pressure": beerPressure,
  "the-author": theAuthor,
};

export const GAME_LIST: GameModule[] = GAME_IDS.map((id) => GAME_MODULES[id]);

export function getGame(id: GameId): GameModule {
  return GAME_MODULES[id];
}

export const CATEGORY_LABELS = {
  trivia: "Trivia",
  social: "Social",
  creative: "Creative",
  word: "Word",
  action: "Action",
} as const;
