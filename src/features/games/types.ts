import type { LucideIcon } from "lucide-react";
import type { GameId, GameMeta } from "@shared/games";
import type { GameViews } from "./engine/views";

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
  /** Show the round countdown (Reflex hides it: it would reveal when GO fires). */
  showTimer?: boolean;
  /** Background music the display loops during this game (R2 URL; undefined = no music). */
  music?: string;
  /** Lazy-loaded presentation for display + phone. Absent = not playable yet. */
  loadViews?: () => Promise<GameViews>;
}
