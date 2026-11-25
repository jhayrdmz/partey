import { useState } from "react";
import { Crown, FastForward, Flag, Gamepad2, Loader2, Pause, Play, RotateCcw, Shuffle, SkipForward, Users } from "lucide-react";
import { Link } from "react-router";
import { toast } from "sonner";
import type { RoomDoc } from "@shared/types";
import type { GameControlAction, PublicGameState } from "@shared/engine";
import { TimerBar } from "@/features/games/shared/TimerBar";
import { useAutoTick } from "@/features/games/engine/useAutoTick";
import { getGame } from "@/features/games/registry";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { call, errorMessage } from "@/services/firebase";
import { cn } from "@/utils/cn";

/** Card chrome removed when the controls sit inside the mobile BottomBar (which has its own). */
const IN_BAR_CARD = "gap-2 rounded-none border-0 bg-transparent p-0 shadow-none backdrop-blur-none";

/** Extra buttons placed beside the main action: "row" next to Start, "header" (small) beside a live game's name. */
export type HostControlActions = (placement: "row" | "header") => React.ReactNode;

/**
 * Context-aware game controls. All transitions are server-side callables; the
 * buttons only express intent. `inBar` renders a slimmer layout for the sticky BottomBar.
 */
export function HostControls({
  room,
  roomId,
  live,
  compact = false,
  inBar = false,
  actions,
}: {
  room: RoomDoc;
  roomId: string;
  live?: PublicGameState | null;
  compact?: boolean;
  inBar?: boolean;
  actions?: HostControlActions;
}) {
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
      <Card className={cn("items-center gap-3 text-center", inBar && IN_BAR_CARD)}>
        {inBar ? (
          <p className="flex items-center gap-2 font-extrabold">
            <Crown className="size-5 text-mango" /> Tournament complete!
          </p>
        ) : (
          <>
            <Crown className="size-10 text-mango" />
            <p className="text-xl font-extrabold">Tournament complete!</p>
            <p className="text-sm text-muted-foreground">The champion is on the big screen. This room closes in about 15 minutes.</p>
          </>
        )}
        <div className="flex w-full gap-2">
          {actions?.("row")}
          <Button asChild size={actions ? "xl" : "lg"} variant="party" className="min-w-0 flex-1">
            <Link to="/host">Start a new room</Link>
          </Button>
        </div>
      </Card>
    );
  }

  if (room.status === "playing" && game) {
    return <LiveGameControls room={room} roomId={roomId} gameName={game.meta.name} live={live} busy={busy} run={run} end={end} icon={icon} inBar={inBar} actions={actions} />;
  }

  // waiting
  const playedSome = isTournament && room.currentGameIndex > 0;
  // Action on the first line, game name below, so it fits beside the quick actions on any phone.
  const label = !game
    ? "Pick a game"
    : isTournament
      ? room.currentGameIndex === 0
        ? "Start tournament"
        : `Start game ${room.currentGameIndex + 1} of ${room.lineup.length}`
      : room.lastPlayedGameId === game.meta.id
        ? "Replay"
        : "Start";
  const subLabel = game?.meta.name;

  return (
    <div className="space-y-2">
      {!compact && notEnough && game && (
        <p className="text-center text-sm font-semibold text-warning">
          {game.meta.name} needs at least {game.meta.minPlayers} player{game.meta.minPlayers === 1 ? "" : "s"} ({room.playerCount} joined).
        </p>
      )}
      <div className="flex gap-2">
        {actions?.("row")}
        <Button size="xl" variant="party" className="min-w-0 flex-1" onClick={start} disabled={Boolean(busy) || !game || notEnough}>
          {icon("start", room.lastPlayedGameId === game?.meta.id && !isTournament ? RotateCcw : Play)}
          <span className="flex min-w-0 flex-col items-start leading-tight">
            <span className="max-w-full truncate">{label}</span>
            {subLabel && <span className="max-w-full truncate text-sm font-semibold opacity-85">{subLabel}</span>}
          </span>
        </Button>
      </div>
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

const PHASE_LABEL = { intro: "How to play", question: "Answering", reveal: "Results" } as const;

function LiveGameControls({
  room,
  roomId,
  gameName,
  live,
  busy,
  run,
  end,
  icon,
  inBar,
  actions,
}: {
  room: RoomDoc;
  roomId: string;
  gameName: string;
  live: PublicGameState | null | undefined;
  busy: string | null;
  run: (key: string, fn: () => Promise<unknown>) => Promise<void>;
  end: () => Promise<void>;
  icon: (key: string, Icon: React.ElementType) => React.ReactNode;
  inBar: boolean;
  actions?: HostControlActions;
}) {
  // The host's device also nudges the server when a timer expires.
  useAutoTick(roomId, live);
  const isTournament = room.gameMode === "tournament";
  const control = (action: GameControlAction) => run(action, () => call("controlGame", { roomId, action }));
  const nextLabel = !live ? "Next" : live.phase === "intro" ? "Start round 1" : live.phase === "question" ? "Reveal now" : live.round >= live.totalRounds ? "Show results" : "Next round";

  return (
    <Card className={cn("gap-3", inBar && IN_BAR_CARD)}>
      <div className="flex items-center gap-3">
        <span className="relative flex size-3">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-guava opacity-75" />
          <span className="relative inline-flex size-3 rounded-full bg-guava" />
        </span>
        <p className="min-w-0 flex-1 truncate font-extrabold">
          {gameName}
          {isTournament && <span className="font-semibold text-muted-foreground"> · Game {room.currentGameIndex + 1}/{room.lineup.length}</span>}
        </p>
        {actions && <div className="flex shrink-0 gap-1.5">{actions("header")}</div>}
      </div>
      {live && (
        <div className="space-y-2 rounded-xl bg-secondary/40 p-3">
          <div className="flex items-center justify-between text-sm font-bold">
            <span>{live.phase === "intro" ? PHASE_LABEL.intro : `Round ${live.round}/${live.totalRounds} · ${PHASE_LABEL[live.phase]}`}</span>
            {live.phase === "question" && (
              <span className="flex items-center gap-1 tabular-nums text-muted-foreground">
                <Users className="size-4" /> {live.submitted}/{live.eligible} answered
              </span>
            )}
          </div>
          <TimerBar endsAtMs={live.phaseEndsAtMs} durationMs={live.phaseDurationMs} paused={live.paused} remainingMs={live.remainingMs} />
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        {live?.paused ? (
          <Button variant="accent" onClick={() => control("resume")} disabled={Boolean(busy)}>
            {icon("resume", Play)} Resume
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => control("pause")} disabled={Boolean(busy) || !live}>
            {icon("pause", Pause)} Pause
          </Button>
        )}
        <Button variant="secondary" onClick={() => control("next")} disabled={Boolean(busy) || !live || live.paused}>
          {icon("next", FastForward)} {nextLabel}
        </Button>
        {live?.phase === "question" && (
          <Button variant="outline" onClick={() => control("skip")} disabled={Boolean(busy) || live.paused}>
            {icon("skip", SkipForward)} Skip round
          </Button>
        )}
        <Button variant="destructive" onClick={end} disabled={Boolean(busy)} className={live?.phase === "question" ? "" : "col-span-2"}>
          {icon("end", Flag)} End game
        </Button>
      </div>
    </Card>
  );
}
