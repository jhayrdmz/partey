import type { GameViews } from "../engine/views";
import { CupLocked, CupPad, CupResult, DisplayCupReveal, DisplayCups } from "./components";

export const views: GameViews = {
  // Keyed by round: a new round's shuffle (and each reveal's lifts) start fresh.
  DisplayQuestion: ({ game }) => (game.round_data ? <DisplayCups key={game.round} game={game} /> : null),
  DisplayReveal: ({ game }) => <DisplayCupReveal key={game.round} game={game} />,
  PlayerQuestion: (props) => (props.game.round_data ? <CupPad key={props.game.round} {...props} /> : null),
  PlayerAnswered: (props) => <CupLocked {...props} />,
  PlayerReveal: ({ game, me, uid }) => <CupResult game={game} me={me} uid={uid} />,
};
