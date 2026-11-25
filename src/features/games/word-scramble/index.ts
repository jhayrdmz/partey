import { Shuffle } from "lucide-react";
import { GAMES } from "@shared/games";
import type { GameModule } from "../types";

export const module: GameModule = {
  id: "word-scramble",
  meta: GAMES["word-scramble"],
  icon: Shuffle,
  art: { from: "#16a34a", to: "#0891b2", emoji: "🔤" },
  interactions: ["text"],
  howToPlay: ["Scrambled letters appear on the big screen.", "Type the real word on your phone.", "First correct answers win the most points."],
};
