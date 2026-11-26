import { Timer } from "lucide-react";
import { GAMES } from "@shared/games";
import type { GameModule } from "../types";
import { MEDIA, mediaUrl } from "@/utils/media";

export const module: GameModule = {
  id: "reflex-battle",
  meta: GAMES["reflex-battle"],
  icon: Timer,
  art: { from: "#7fe0c8", to: "#7fe0c8", emoji: "🏁" },
  interactions: ["reaction"],
  showTimer: false,
  // "Space Cat's Slot Machine" by Otomusu (https://otomusu.com/), royalty-free; credit is optional. Hosted on R2.
  music: mediaUrl(MEDIA.reflexBattleMusic),
  loadViews: () => import("./views").then((m) => m.views),
  howToPlay: ["Watch the big screen and wait for GO.", "Tap your phone the instant it appears.", "Tap too early and you are out for the round."],
};
