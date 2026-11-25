import type { ComponentType } from "react";
import type { PlayerPrivateDoc, PublicGameState } from "@shared/engine";

export interface DisplayViewProps {
  game: PublicGameState;
}

export interface PlayerQuestionProps {
  game: PublicGameState;
  me: PlayerPrivateDoc | null;
  /** This player's uid (e.g. to tell whose turn it is). */
  uid: string;
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
  /** Optional private card shown on the phone in every phase, including the intro (e.g. a secret role). */
  PlayerSecret?: ComponentType<{ game: PublicGameState; me: PlayerPrivateDoc | null }>;
  /** Optional replacement for the phone's round result screen. */
  PlayerReveal?: ComponentType<{ game: PublicGameState; me: PlayerPrivateDoc; uid: string }>;
}
