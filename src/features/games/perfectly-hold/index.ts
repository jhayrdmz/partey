import { Hand } from "lucide-react";
import { GAMES } from "@shared/games";
import type { GameModule } from "../types";
import cover from "./cover.webp";
import thumb from "./icon.webp";

export const module: GameModule = {
  id: "perfectly-hold",
  meta: GAMES["perfectly-hold"],
  icon: Hand,
  art: { from: "#ff8a3d", cover, thumb },
  interactions: ["reaction"],
  howToPlay: [
    "Press and hold the button on your phone while the meter fills.",
    "Let go when it hits the target zone. Too late and you bust.",
    "The closer your release, the more you score.",
  ],
};
