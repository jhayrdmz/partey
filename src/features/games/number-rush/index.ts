import { ArrowUpDown } from "lucide-react";
import { GAMES } from "@shared/games";
import type { GameModule } from "../types";
import cover from "./cover.webp";
import thumb from "./icon.webp";

export const module: GameModule = {
  id: "number-rush",
  meta: GAMES["number-rush"],
  icon: ArrowUpDown,
  art: { from: "#e02f45", cover, thumb },
  interactions: ["multiple-choice"],
  howToPlay: [
    "A number card appears on the big screen.",
    "Predict on your phone: will the next card be higher or lower?",
    "Keep your streak alive. One wrong call and it resets.",
  ],
};
