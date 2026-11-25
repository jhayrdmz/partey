import { VenetianMask } from "lucide-react";
import type { ImpostorReveal, ImpostorRound } from "@shared/engine";
import { GAMES } from "@shared/games";
import { MEDIA, mediaUrl } from "@/utils/media";
import type { GameModule } from "../types";

export const module: GameModule = {
  id: "impostor",
  meta: GAMES["impostor"],
  icon: VenetianMask,
  art: { from: "#be185d", to: "#7c3aed", emoji: "🕵️" },
  music: mediaUrl(MEDIA.impostorMusic),
  interactions: ["private-clue", "text", "vote"],
  // Scores only change at the very end; a "Top scores" strip after every clue would be noise.
  showStandings: false,
  loadViews: () => import("./views").then((m) => m.views),
  hostControls: (game) => {
    const pub = game.round_data as ImpostorRound | null;
    const r = game.reveal as ImpostorReveal | null;
    if (game.phase === "intro") return { nextLabel: "Start clues" };
    if (game.phase === "question") return { nextLabel: pub?.kind === "vote" ? "Reveal votes" : "Next turn" };
    if (r?.kind === "votes" && !r.outcome) return { main: { name: "revote", label: "Revote" }, skip: { name: "reveal", label: "Reveal" } };
    if (r?.kind === "clue" && pub?.kind === "turn") return { nextLabel: pub.turn >= pub.turns ? "Start voting" : "Next turn" };
    return {};
  },
  howToPlay: [
    "Peek at your phone: you get the secret word, or you're the Impostor.",
    "Take turns saying one word about it out loud, and type it in.",
    "Vote out the Impostor. Impostor: blend in and survive!",
  ],
};
