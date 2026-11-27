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
  // The round's clock includes the shuffle; the big screen and phones show the picking countdown instead.
  // Phones play the shuffle too (from the round data), so the game works without a TV.
  showTimer: false,
  loadViews: () => import("./views").then((m) => m.views),
  hostControls: (game) => {
    if (game.phase === "intro") return { nextLabel: "Start round 1" };
    if (game.phase === "question") return { nextLabel: "Reveal the ball" };
    return { nextLabel: game.round >= game.totalRounds ? "Show results" : "Next round" };
  },
  howToPlay: [
    "A yellow ball hides under one of three cups, on the big screen and on your phone.",
    "Watch closely as the cups shuffle. More swaps every round, and faster as the game goes on.",
    "When they stop, tap the cup with the ball. Right cup: 100 points, plus a bonus for right picks in a row.",
  ],
};
