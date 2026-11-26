import { Beer } from "lucide-react";
import { GAMES } from "@shared/games";
import type { GameModule } from "../types";
import cover from "./cover.webp";
import thumb from "./icon.webp";

export const module: GameModule = {
  id: "beer-pressure",
  meta: GAMES["beer-pressure"],
  icon: Beer,
  art: { from: "#3a4255", cover, thumb },
  interactions: ["reaction"],
  howToPlay: [
    "Hold the tap on your phone to pour. Your glass fills on the big screen.",
    "Let go as close to the MAX line as you dare.",
    "Closest pour wins. Overflow and you score nothing.",
  ],
};
