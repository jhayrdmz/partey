import { Zap } from "lucide-react";
import { GAMES } from "@shared/games";
import type { GameModule } from "../types";

export const module: GameModule = {
  id: "speed-quiz",
  meta: GAMES["speed-quiz"],
  icon: Zap,
  art: { from: "#7c3aed", to: "#2563eb", emoji: "⚡" },
  interactions: ["multiple-choice"],
  howToPlay: ["A question appears on the big screen.", "Tap the right answer on your phone — fast.", "Correct answers earn points; faster answers earn more."],
};
