import { ArrowUpDown } from "lucide-react";
import { GAMES } from "@shared/games";
import type { GameModule } from "../types";
import cover from "./cover.webp";
import thumb from "./icon.webp";

export const module: GameModule = {
  id: "number-rush",
  meta: GAMES["number-rush"],
  icon: ArrowUpDown,
  art: { from: "#e02f45", cover, thumb },
  interactions: ["multiple-choice"],
  // The reveal has its own live leaderboard with streaks.
  showStandings: false,
  loadViews: () => import("./views").then((m) => m.views),
  hostControls: (game) => {
    if (game.phase === "intro") return { nextLabel: "Start round 1" };
    if (game.phase === "question") return { nextLabel: "Reveal the number" };
    return { nextLabel: game.round >= game.totalRounds ? "Show results" : "Next round" };
  },
  howToPlay: [
    "A three-digit number appears (100–999).",
    "Will the next one be HIGHER or LOWER? Pick on your phone before time runs out.",
    "Right calls score 10, and streaks multiply them: 1.25x from 2 in a row, 1.5x from 4, 2x from 6. A miss resets it.",
  ],
};
