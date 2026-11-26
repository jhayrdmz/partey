import type { ImpostorReveal, ImpostorRound, PublicGameState } from "@shared/engine";
import { AvatarBubble } from "@/components/shared/AvatarBubble";
import type { GameViews } from "../engine/views";
import {
  ClueInput,
  DisplayClueReveal,
  DisplayTurn,
  DisplayVote,
  DisplayVotes,
  Listening,
  PlayerOutcome,
  RoleCard,
  VotePicker,
} from "./components";

const round = (game: PublicGameState) => game.round_data as ImpostorRound | null;
const reveal = (game: PublicGameState) => game.reveal as ImpostorReveal | null;

/* ─── Views ──────────────────────────────────────────────────────────── */

export const views: GameViews = {
  DisplayQuestion: ({ game }) => {
    const pub = round(game);
    if (!pub) return null;
    return pub.kind === "turn" ? <DisplayTurn pub={pub} /> : <DisplayVote pub={pub} />;
  },
  DisplayReveal: ({ game }) => {
    const r = reveal(game);
    if (!r) return null;
    return r.kind === "clue" ? <DisplayClueReveal r={r} /> : <DisplayVotes r={r} />;
  },
  PlayerSecret: ({ me }) => <RoleCard me={me} />,
  PlayerQuestion: ({ game, uid, submit, submitting }) => {
    const pub = round(game);
    if (!pub) return null;
    if (pub.kind === "vote") return <VotePicker pub={pub} uid={uid} submit={submit} submitting={submitting} />;
    return pub.turnPlayer.playerId === uid ? <ClueInput submit={submit} submitting={submitting} /> : <Listening pub={pub} />;
  },
  PlayerAnswered: ({ game }) => {
    const pub = round(game);
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-3xl bg-card text-center">
        <span className="text-6xl">{pub?.kind === "vote" ? "🗳️" : "🎤"}</span>
        <p className="text-2xl font-black">{pub?.kind === "vote" ? "Vote locked in!" : "Clue sent!"}</p>
        <p className="text-muted-foreground">{pub?.kind === "vote" ? "Waiting for everyone to vote…" : "Watch the big screen."}</p>
      </div>
    );
  },
  PlayerReveal: ({ game, me }) => {
    const r = reveal(game);
    if (!r) return null;
    if (r.kind === "clue") {
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <AvatarBubble avatar={r.player.avatar} size="md" />
          <p className="text-lg font-bold text-muted-foreground">{r.player.nickname}</p>
          <p className="text-4xl font-black text-mango">{r.clue ? `“${r.clue}”` : "🗣️"}</p>
        </div>
      );
    }
    return <PlayerOutcome r={r} mine={me} />;
  },
};
