import { VenetianMask } from "lucide-react";
import { GAMES } from "@shared/games";
import type { GameModule } from "../types";

export const module: GameModule = {
  id: "impostor",
  meta: GAMES["impostor"],
  icon: VenetianMask,
  art: { from: "#be185d", to: "#7c3aed", emoji: "🕵️" },
  interactions: ["private-clue", "text", "vote"],
  howToPlay: ["Everyone gets a secret word on their phone — except the impostor.", "Take turns giving a one-word clue.", "Vote for who you think is faking it."],
};
