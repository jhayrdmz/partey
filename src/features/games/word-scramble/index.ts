import { Shuffle } from "lucide-react";
import { GAMES } from "@shared/games";
import type { GameModule } from "../types";
import { MEDIA, mediaUrl } from "@/utils/media";
import cover from "./cover.webp";
import thumb from "./icon.webp";

export const module: GameModule = {
  id: "word-scramble",
  meta: GAMES["word-scramble"],
  icon: Shuffle,
  art: { from: "#ff6b5b", cover, thumb },
  interactions: ["text"],
  // "遊園地のにぎやかな一日" (A lively day at the amusement park) by Otomusu, royalty-free. Hosted on R2.
  music: mediaUrl(MEDIA.wordScrambleMusic),
  // Keep guessing until you get it (one guess every 5 seconds).
  multipleAttempts: true,
  loadViews: () => import("./views").then((m) => m.views),
  hostControls: (game) => {
    if (game.phase === "intro") return { nextLabel: "Start round 1" };
    if (game.phase === "question") return { nextLabel: "Reveal word" };
    return { nextLabel: game.round >= game.totalRounds ? "Show results" : "Next word" };
  },
  howToPlay: [
    "Scrambled letters appear on the big screen and your phone.",
    "Tap the letters in order to spell the real word. Wrong? Try again every 5 seconds, no penalty.",
    "First right answer scores 100, then 75, 50, and 25 for everyone after.",
  ],
};
