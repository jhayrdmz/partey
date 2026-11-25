import { Timer } from "lucide-react";
import { GAMES } from "@shared/games";
import type { GameModule } from "../types";

export const module: GameModule = {
  id: "reflex-battle",
  meta: GAMES["reflex-battle"],
  icon: Timer,
  art: { from: "#dc2626", to: "#f59e0b", emoji: "🏁" },
  interactions: ["reaction"],
  howToPlay: ["Watch the big screen and wait for GO.", "Tap your phone the instant it appears.", "Tap too early and you are out for the round."],
};
