import { Users } from "lucide-react";
import { GAMES } from "@shared/games";
import type { GameModule } from "../types";

export const module: GameModule = {
  id: "majority",
  meta: GAMES["majority"],
  icon: Users,
  art: { from: "#0891b2", to: "#4f46e5", emoji: "👥" },
  interactions: ["vote"],
  howToPlay: ["A question with a few options appears.", "Pick the answer you think MOST players will choose.", "Match the majority to score."],
};
