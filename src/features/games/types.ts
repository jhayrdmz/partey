import type { LucideIcon } from "lucide-react";
import type { PublicGameState } from "@shared/engine";
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
  /**
   * Artwork. `cover` is a 1280×720 image (title baked in) for cards and intros; `thumb` is a small
   * square icon (transparent) for lineups and headers. `from` is the backdrop while images load.
   */
  art: { from: string; cover: string; thumb: string };
  howToPlay: string[];
  interactions: InteractionKind[];
  /** Show the round countdown (Reflex hides it: it would reveal when GO fires). */
  showTimer?: boolean;
  /**
   * Players may answer several times per round until one is right (Draw & Guess). The phone keeps
   * the answer form up while an attempt is in flight instead of showing "answer locked in".
   */
  multipleAttempts?: boolean;
  /** Show the "Top scores" strip on the display after each round (default true). */
  showStandings?: boolean;
  /**
   * Customise the host's live controls for the current state: rename the main action, or swap the
   * main/skip buttons for game actions (sent as controlGame { action: "game", name }).
   */
  hostControls?: (game: PublicGameState) => HostControlOverrides;
  /** Background music the display loops during this game (R2 URL; undefined = no music). */
  music?: string;
  /** Lazy-loaded presentation for display + phone. Absent = not playable yet. */
  loadViews?: () => Promise<GameViews>;
}

export interface HostGameAction {
  /** Sent as controlGame { action: "game", name }. */
  name: string;
  label: string;
}

export interface HostControlOverrides {
  /** Label for the main "next" action (default "Reveal now" / "Next round"…). */
  nextLabel?: string;
  /** Replace the main action with a game action. */
  main?: HostGameAction;
  /** Replace the Skip button with a game action. */
  skip?: HostGameAction;
}
