import type { ComponentType } from "react";
import type { PlayerPrivateDoc, PublicGameState, SubmitAnswerResponse } from "@shared/engine";

export interface DisplayViewProps {
  game: PublicGameState;
  roomId: string;
}

export interface PlayerQuestionProps {
  game: PublicGameState;
  me: PlayerPrivateDoc | null;
  /** This player's uid (e.g. to tell whose turn it is). */
  uid: string;
  roomId: string;
  /**
   * Send an answer. Resolves with the server's verdict (null if the call failed; the error is
   * toasted). A wrong attempt in a multi-attempt game ({ correct: false }) leaves the round open.
   */
  submit: (answer: unknown) => Promise<SubmitAnswerResponse | null>;
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
  /** Optional live panel on the host's screen during the game (e.g. a preview of the drawing). */
  HostView?: ComponentType<DisplayViewProps>;
}
