import { ImageIcon } from "lucide-react";
import { GAMES } from "@shared/games";
import type { GameModule } from "../types";
import cover from "./cover.webp";
import thumb from "./icon.webp";

export const module: GameModule = {
  id: "picture-reveal",
  meta: GAMES["picture-reveal"],
  icon: ImageIcon,
  art: { from: "#b9a6ff", cover, thumb },
  interactions: ["multiple-choice", "text"],
  howToPlay: ["A hidden picture is revealed tile by tile.", "Lock in your guess whenever you are ready.", "The earlier you guess right, the more you score."],
};
