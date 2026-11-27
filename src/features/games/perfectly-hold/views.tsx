import type { GameViews } from "../engine/views";
import { DisplayHold, DisplayHoldReveal, HoldLocked, HoldPad, HoldResult } from "./components";

export const views: GameViews = {
  DisplayQuestion: ({ game }) => (game.round_data ? <DisplayHold game={game} /> : null),
  // Keyed by round: each reveal starts in round order, then re-arranges by result.
  DisplayReveal: ({ game }) => <DisplayHoldReveal key={game.round} game={game} />,
  PlayerQuestion: (props) => (props.game.round_data ? <HoldPad {...props} /> : null),
  PlayerAnswered: (props) => <HoldLocked {...props} />,
  PlayerReveal: ({ game, me, uid }) => <HoldResult game={game} me={me} uid={uid} />,
};
