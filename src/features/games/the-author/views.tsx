import type { GameViews } from "../engine/views";
import { AuthorLocked, AuthorPad, AuthorResult, DisplayAuthorReveal, DisplayAuthorRound } from "./components";

export const views: GameViews = {
  DisplayQuestion: ({ game }) => (game.round_data ? <DisplayAuthorRound key={game.round} game={game} /> : null),
  // Keyed by round: each reveal's spotlight → author → points sequence starts fresh.
  DisplayReveal: ({ game }) => <DisplayAuthorReveal key={game.round} game={game} />,
  PlayerQuestion: (props) => (props.game.round_data ? <AuthorPad key={props.game.round} {...props} /> : null),
  PlayerAnswered: (props) => <AuthorLocked {...props} />,
  PlayerReveal: ({ game, me, uid }) => <AuthorResult game={game} me={me} uid={uid} />,
};
