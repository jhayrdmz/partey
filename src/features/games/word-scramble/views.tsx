import type { GameViews } from "../engine/views";
import { DisplayScramble, DisplayScrambleReveal, HostScramblePanel, ScramblePad, ScrambleSolved } from "./components";

export const views: GameViews = {
  DisplayQuestion: ({ game }) => (game.round_data ? <DisplayScramble game={game} /> : null),
  DisplayReveal: ({ game }) => <DisplayScrambleReveal game={game} />,
  HostView: ({ game }) => <HostScramblePanel game={game} />,
  PlayerQuestion: ({ game, me, submit, submitting }) => (game.round_data ? <ScramblePad game={game} me={me} submit={submit} submitting={submitting} /> : null),
  PlayerAnswered: ({ game, uid }) => <ScrambleSolved game={game} uid={uid} />,
};
