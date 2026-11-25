import { Users } from "lucide-react";
import { GAMES } from "@shared/games";
import type { GameModule } from "../types";
import { MEDIA, mediaUrl } from "@/utils/media";

export const module: GameModule = {
  id: "majority",
  meta: GAMES["majority"],
  icon: Users,
  art: { from: "#0891b2", to: "#4f46e5", emoji: "👥" },
  interactions: ["vote"],
  // "Brass Band on the Hill" by Otomusu (https://otomusu.com/), royalty-free; credit is optional. Hosted on R2.
  music: mediaUrl(MEDIA.majorityMusic),
  loadViews: () => import("./views").then((m) => m.views),
  howToPlay: ["A question with a few options appears.", "Pick the answer you think MOST players will choose.", "Match the majority to score."],
};
