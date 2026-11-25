import { Brush } from "lucide-react";
import { GAMES } from "@shared/games";
import type { GameModule } from "../types";

export const module: GameModule = {
  id: "drawing",
  meta: GAMES["drawing"],
  icon: Brush,
  art: { from: "#ea580c", to: "#db2777", emoji: "🎨" },
  interactions: ["drawing", "text"],
  howToPlay: ["One player gets a secret prompt to draw.", "Everyone else guesses on their phones.", "Faster guesses score more — for guesser and artist."],
};
