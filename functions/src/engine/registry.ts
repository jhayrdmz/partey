import type { GameId } from "../../../shared/games";
import type { GameHandler } from "./types";
import { speedQuiz } from "../games/speedQuiz";
import { majority } from "../games/majority";
import { reflex } from "../games/reflex";
import { impostor } from "../games/impostor";
import { drawing } from "../games/drawing";

/** Server game handlers. Games without a handler can't be started yet. */
const HANDLERS: Partial<Record<GameId, GameHandler>> = {
  "speed-quiz": speedQuiz as GameHandler,
  majority: majority as GameHandler,
  "reflex-battle": reflex as GameHandler,
  impostor: impostor as GameHandler,
  drawing: drawing as GameHandler,
};

export function getHandler(id: GameId): GameHandler | undefined {
  return HANDLERS[id];
}
