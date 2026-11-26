import { Zap } from "lucide-react";
import { GAMES } from "@shared/games";
import type { GameModule } from "../types";
import { MEDIA, mediaUrl } from "@/utils/media";
import cover from "./cover.webp";
import thumb from "./icon.webp";

export const module: GameModule = {
  id: "speed-quiz",
  meta: GAMES["speed-quiz"],
  icon: Zap,
  art: { from: "#ff6b5b", cover, thumb },
  interactions: ["multiple-choice"],
  // "Disco Funk Fever" by Otomusu (https://otomusu.com/), royalty-free; credit is optional. Hosted on R2.
  music: mediaUrl(MEDIA.speedQuizMusic),
  loadViews: () => import("./views").then((m) => m.views),
  howToPlay: ["A question appears on the big screen.", "Tap the right answer on your phone — fast.", "Correct answers earn points; faster answers earn more."],
};
