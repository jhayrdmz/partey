import type { ComponentType } from "react";
import type { PlayerPrivateDoc, PublicGameState } from "@shared/engine";

export interface DisplayViewProps {
  game: PublicGameState;
}

export interface PlayerQuestionProps {
  game: PublicGameState;
  me: PlayerPrivateDoc | null;
  submit: (answer: unknown) => void;
  submitting: boolean;
}

/** Per-game presentation components, lazy-loaded by role shells. */
export interface GameViews {
  DisplayQuestion: ComponentType<DisplayViewProps>;
  DisplayReveal: ComponentType<DisplayViewProps>;
  PlayerQuestion: ComponentType<PlayerQuestionProps>;
  /** Optional custom "answer locked" view for the phone. */
  PlayerAnswered?: ComponentType<PlayerQuestionProps>;
}
