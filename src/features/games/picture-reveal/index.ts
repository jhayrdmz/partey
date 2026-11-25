import { ImageIcon } from "lucide-react";
import { GAMES } from "@shared/games";
import type { GameModule } from "../types";

export const module: GameModule = {
  id: "picture-reveal",
  meta: GAMES["picture-reveal"],
  icon: ImageIcon,
  art: { from: "#ca8a04", to: "#ea580c", emoji: "🖼️" },
  interactions: ["multiple-choice", "text"],
  howToPlay: ["A hidden picture is revealed tile by tile.", "Lock in your guess whenever you are ready.", "The earlier you guess right, the more you score."],
};
