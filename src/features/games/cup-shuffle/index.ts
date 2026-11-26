import { Eye } from "lucide-react";
import { GAMES } from "@shared/games";
import type { GameModule } from "../types";
import cover from "./cover.webp";
import thumb from "./icon.webp";

export const module: GameModule = {
  id: "cup-shuffle",
  meta: GAMES["cup-shuffle"],
  icon: Eye,
  art: { from: "#b8692e", cover, thumb },
  interactions: ["multiple-choice"],
  howToPlay: [
    "A ball hides under one cup on the big screen.",
    "Watch closely as the cups shuffle, faster each round.",
    "Pick the right cup on your phone to score.",
  ],
};
