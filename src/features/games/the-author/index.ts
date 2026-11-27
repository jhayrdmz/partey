import { Feather } from "lucide-react";
import type { AuthorReveal, AuthorRound } from "@shared/engine";
import { GAMES } from "@shared/games";
import type { GameModule } from "../types";
import cover from "./cover.webp";
import thumb from "./icon.webp";

export const module: GameModule = {
  id: "the-author",
  meta: GAMES["the-author"],
  icon: Feather,
  art: { from: "#d9b47e", cover, thumb },
  interactions: ["text", "vote"],
  loadViews: () => import("./views").then((m) => m.views),
  hostControls: (game) => {
    if (game.phase === "intro") return { nextLabel: "Start question 1" };
    if (game.phase === "question") return { nextLabel: (game.round_data as AuthorRound | null)?.kind === "write" ? "Lock answers" : "Reveal the author" };
    if (game.round >= game.totalRounds) return { nextLabel: "Show results" };
    return { nextLabel: (game.reveal as AuthorReveal | null)?.kind === "collected" ? "Start guessing" : "Next" };
  },
  howToPlay: [
    "Everyone answers the same question on their phone, in secret.",
    "The answers show up one at a time with no names. Pick who you think wrote each one.",
    "Right guess: 100 points, plus 50 more for each right guess in a row (150, 200, 250…).",
  ],
};
