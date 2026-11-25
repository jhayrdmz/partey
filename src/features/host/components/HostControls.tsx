import { useState } from "react";
import { Crown, Flag, Gamepad2, Loader2, Play, RotateCcw, Shuffle } from "lucide-react";
import { Link } from "react-router";
import { toast } from "sonner";
import type { RoomDoc } from "@shared/types";
import { getGame } from "@/features/games/registry";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { call, errorMessage } from "@/services/firebase";

/**
 * Context-aware game controls. All transitions are server-side callables; the
 * buttons only express intent.
 */
export function HostControls({ room, roomId, compact = false }: { room: RoomDoc; roomId: string; compact?: boolean }) {
  const [busy, setBusy] = useState<string | null>(null);
  const isTournament = room.gameMode === "tournament";
  const entry = room.lineup[isTournament ? room.currentGameIndex : 0];
  const game = entry ? getGame(entry.gameId) : null;
  const notEnough = Boolean(game && room.playerCount < game.meta.minPlayers);

  async function run(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    try {
      await fn();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }
  const start = () => run("start", () => call("startGame", { roomId, ...(isTournament ? {} : { gameId: entry?.gameId }) }));
  const end = () => run("end", () => call("endGame", { roomId }));
  const icon = (key: string, Icon: React.ElementType) => (busy === key ? <Loader2 className="animate-spin" /> : <Icon />);

  if (room.status === "finished") {
    return (
      <Card className="items-center gap-3 text-center">
        <Crown className="size-10 text-mango" />
        <p className="text-xl font-extrabold">Tournament complete!</p>
        <p className="text-sm text-muted-foreground">The champion is on the big screen. This room closes in about 15 minutes.</p>
        <Button asChild size="lg" variant="party" className="w-full">
          <Link to="/host">Start a new room</Link>
        </Button>
      </Card>
    );
  }

  if (room.status === "playing" && game) {
    return (
      <Card className="gap-3">
        <div className="flex items-center gap-3">
          <span className="relative flex size-3">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-guava opacity-75" />
            <span className="relative inline-flex size-3 rounded-full bg-guava" />
          </span>
          <p className="font-extrabold">
            Now playing: {game.meta.name}
            {isTournament && <span className="font-semibold text-muted-foreground"> · Game {room.currentGameIndex + 1} of {room.lineup.length}</span>}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">Players see the instructions on their phones. Round controls (pause, skip) arrive with each game's engine.</p>
        <Button size="lg" variant="destructive" onClick={end} disabled={Boolean(busy)}>
          {icon("end", Flag)} End game
        </Button>
      </Card>
    );
  }

  // waiting
  const playedSome = isTournament && room.currentGameIndex > 0;
  const label = !game
    ? "Pick a game"
    : isTournament
      ? room.currentGameIndex === 0
        ? "Start tournament"
        : `Start game ${room.currentGameIndex + 1} of ${room.lineup.length}`
      : room.lastPlayedGameId === game.meta.id
        ? `Replay ${game.meta.name}`
        : `Start ${game.meta.name}`;

  return (
    <div className="space-y-2">
      {!compact && notEnough && game && (
        <p className="text-center text-sm font-semibold text-warning">
          {game.meta.name} needs at least {game.meta.minPlayers} player{game.meta.minPlayers === 1 ? "" : "s"} ({room.playerCount} joined).
        </p>
      )}
      <Button size="xl" variant="party" className="w-full" onClick={start} disabled={Boolean(busy) || !game || notEnough}>
        {icon("start", room.lastPlayedGameId === game?.meta.id && !isTournament ? RotateCcw : Play)} {label}
      </Button>
      {!isTournament && room.lastPlayedGameId && !compact && (
        <Button asChild variant="outline" className="w-full">
          <Link to={`/host/${roomId}/games`}>
            <Shuffle className="size-4" /> Choose another game
          </Link>
        </Button>
      )}
      {playedSome && !compact && (
        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Gamepad2 className="size-4" /> The leaderboard is showing on the display.
        </p>
      )}
    </div>
  );
}
