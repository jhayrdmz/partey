import { Brush } from "lucide-react";
import { GAMES } from "@shared/games";
import { MEDIA, mediaUrl } from "@/utils/media";
import type { GameModule } from "../types";
import cover from "./cover.webp";
import thumb from "./icon.webp";

export const module: GameModule = {
  id: "drawing",
  meta: GAMES["drawing"],
  icon: Brush,
  art: { from: "#7fe0c8", cover, thumb },
  interactions: ["drawing", "text"],
  music: mediaUrl(MEDIA.drawingMusic),
  multipleAttempts: true,
  loadViews: () => import("./views").then((m) => m.views),
  hostControls: (game) => {
    if (game.phase === "intro") return { nextLabel: "Start drawing" };
    if (game.phase === "question") return { nextLabel: "End round" };
    return { nextLabel: game.round >= game.totalRounds ? "Show results" : "Next artist" };
  },
  howToPlay: [
    "One player gets a secret prompt on their phone and draws it.",
    "The drawing appears live on the big screen. Everyone else types guesses.",
    "Faster correct guesses score more. The artist scores when anyone gets it.",
  ],
};
