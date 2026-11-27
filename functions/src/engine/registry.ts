import type { GameId } from "../../../shared/games";
import type { GameHandler } from "./types";
import { speedQuiz } from "../games/speedQuiz";
import { majority } from "../games/majority";
import { reflex } from "../games/reflex";
import { impostor } from "../games/impostor";
import { drawing } from "../games/drawing";
import { wordScramble } from "../games/wordScramble";
import { perfectlyHold } from "../games/perfectlyHold";

/** Server game handlers. Games without a handler can't be started yet. */
const HANDLERS: Partial<Record<GameId, GameHandler>> = {
  "speed-quiz": speedQuiz as GameHandler,
  majority: majority as GameHandler,
  "reflex-battle": reflex as GameHandler,
  impostor: impostor as GameHandler,
  drawing: drawing as GameHandler,
  "word-scramble": wordScramble as GameHandler,
  "perfectly-hold": perfectlyHold as GameHandler,
};

export function getHandler(id: GameId): GameHandler | undefined {
  return HANDLERS[id];
}
