import type { LucideIcon } from "lucide-react";
import type { GameId, GameMeta } from "@shared/games";

/** How players interact on their phones; the player shell picks components from these. */
export type InteractionKind = "multiple-choice" | "text" | "vote" | "drawing" | "reaction" | "private-clue";

/**
 * A game module. Modules are independent of host/player/display layers: they
 * describe themselves here and (in Phase 4/5) expose their own Host/Player/Display
 * views that the role shells mount by id.
 */
export interface GameModule {
  id: GameId;
  meta: GameMeta;
  icon: LucideIcon;
  /** Two CSS colors for the card artwork gradient. */
  art: { from: string; to: string; emoji: string };
  howToPlay: string[];
  interactions: InteractionKind[];
}
