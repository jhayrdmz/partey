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
  // A running round clock would give the game away: players must count in their heads.
  showTimer: false,
  loadViews: () => import("./views").then((m) => m.views),
  hostControls: (game) => {
    if (game.phase === "intro") return { nextLabel: "Start round 1" };
    if (game.phase === "question") return { nextLabel: "Reveal results" };
    return { nextLabel: game.round >= game.totalRounds ? "Show results" : "Next round" };
  },
  howToPlay: [
    "The big screen shows a target time, like 10 seconds.",
    "On GO, press and hold the button on your phone. There's no clock: count in your head.",
    "Let go when you think time's up. Closest to the target scores 100, then 75, 50, and 25 for everyone else.",
  ],
};
