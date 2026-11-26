import { Loader2 } from "lucide-react";
import type { DrawRound, DrawSecret } from "@shared/engine";
import type { GameViews } from "../engine/views";
import { ArtistBoard, DisplayDrawing, DisplayDrawingReveal, GuessPad, Guessed, HostDrawingPanel } from "./components";

const secretOf = (secret: unknown) => (secret && typeof secret === "object" && "role" in secret ? (secret as DrawSecret) : null);

export const views: GameViews = {
  DisplayQuestion: ({ game, roomId }) => (game.round_data ? <DisplayDrawing game={game} roomId={roomId} /> : null),
  DisplayReveal: ({ game, roomId }) => <DisplayDrawingReveal game={game} roomId={roomId} />,
  HostView: ({ game, roomId }) => <HostDrawingPanel game={game} roomId={roomId} />,
  PlayerQuestion: ({ game, me, uid, roomId, submit, submitting }) => {
    const pub = game.round_data as DrawRound | null;
    if (!pub) return null;
    if (pub.artist.playerId !== uid) return <GuessPad game={game} pub={pub} submit={submit} submitting={submitting} paused={game.paused} />;
    // The artist: the prompt arrives in their private doc with the round.
    const secret = secretOf(me?.secret);
    if (secret?.role !== "artist" || me?.round !== game.round) {
      return (
        <div className="flex flex-1 items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" /> Getting your prompt…
        </div>
      );
    }
    return <ArtistBoard roomId={roomId} uid={uid} game={game} pub={pub} secret={secret} />;
  },
  PlayerAnswered: ({ game, uid }) => <Guessed game={game} uid={uid} />,
};
