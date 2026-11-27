import type { GameViews } from "../engine/views";
import { DisplayRush, DisplayRushReveal, RushLocked, RushPad, RushResult } from "./components";

export const views: GameViews = {
  DisplayQuestion: ({ game }) => (game.round_data ? <DisplayRush key={game.round} game={game} /> : null),
  // Keyed by round: each reveal rolls the digits and re-sorts the leaderboard from the start.
  DisplayReveal: ({ game }) => <DisplayRushReveal key={game.round} game={game} />,
  PlayerQuestion: (props) => (props.game.round_data ? <RushPad key={props.game.round} {...props} /> : null),
  PlayerAnswered: (props) => <RushLocked {...props} />,
  PlayerReveal: ({ game, me, uid }) => <RushResult game={game} me={me} uid={uid} />,
};
