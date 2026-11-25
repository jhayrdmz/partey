import { Zap } from "lucide-react";
import { GAMES } from "@shared/games";
import type { GameModule } from "../types";
import { MEDIA, mediaUrl } from "@/utils/media";

export const module: GameModule = {
  id: "speed-quiz",
  meta: GAMES["speed-quiz"],
  icon: Zap,
  art: { from: "#7c3aed", to: "#2563eb", emoji: "⚡" },
  interactions: ["multiple-choice"],
  // "Disco Funk Fever" by Otomusu (https://otomusu.com/), royalty-free; credit is optional. Hosted on R2.
  music: mediaUrl(MEDIA.speedQuizMusic),
  loadViews: () => import("./views").then((m) => m.views),
  howToPlay: ["A question appears on the big screen.", "Tap the right answer on your phone — fast.", "Correct answers earn points; faster answers earn more."],
};
