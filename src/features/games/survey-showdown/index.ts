import { ClipboardList } from "lucide-react";
import { GAMES } from "@shared/games";
import type { GameModule } from "../types";

export const module: GameModule = {
  id: "survey-showdown",
  meta: GAMES["survey-showdown"],
  icon: ClipboardList,
  art: { from: "#ffd447", to: "#ffd447", emoji: "📋" },
  interactions: ["text", "multiple-choice"],
  howToPlay: ["We surveyed people with a question.", "Guess the most popular answers.", "Higher-ranked answers are worth more points."],
};
