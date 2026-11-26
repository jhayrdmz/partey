import { Shuffle } from "lucide-react";
import { GAMES } from "@shared/games";
import type { GameModule } from "../types";

export const module: GameModule = {
  id: "word-scramble",
  meta: GAMES["word-scramble"],
  icon: Shuffle,
  art: { from: "#ff6b5b", to: "#ff6b5b", emoji: "🔤" },
  interactions: ["text"],
  howToPlay: ["Scrambled letters appear on the big screen.", "Type the real word on your phone.", "First correct answers win the most points."],
};
