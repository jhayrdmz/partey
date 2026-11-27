import { useState } from "react";
import { Crown, Eye, FastForward, Flag, Gamepad2, Loader2, Pause, Play, RotateCcw, Shuffle, SkipForward, Users } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import type { RoomDoc } from "@shared/types";
import type { GameControlAction, PublicGameState } from "@shared/engine";
import type { GameId } from "@shared/games";
import { TimerBar } from "@/features/games/shared/TimerBar";
import { useAutoTick } from "@/features/games/engine/useAutoTick";
import { getGame } from "@/features/games/registry";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  const [confirmChange, setConfirmChange] = useState(false);
  const navigate = useNavigate();
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
    return <LiveGameControls room={room} roomId={roomId} gameId={game.meta.id} gameName={game.meta.name} live={live} busy={busy} run={run} end={end} icon={icon} inBar={inBar} actions={actions} />;
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
  const canChangeGame = !isTournament && Boolean(room.lastPlayedGameId) && !compact;

  return (
    <div className="space-y-2">
      {!compact && notEnough && game && (
        <p className="text-center text-sm font-semibold text-warning">
          {game.meta.name} needs at least {game.meta.minPlayers} player{game.meta.minPlayers === 1 ? "" : "s"} ({room.playerCount} joined).
        </p>
      )}
      <div className="flex gap-2">
        {actions?.("row")}
        {/* Tighter padding than the xl default, so the label still fits beside the small buttons on a phone. */}
        <Button size="xl" variant="party" className="min-w-0 flex-1 gap-2 px-3" onClick={start} disabled={Boolean(busy) || !game || notEnough}>
          {icon("start", room.lastPlayedGameId === game?.meta.id && !isTournament ? RotateCcw : Play)}
          <span className="flex min-w-0 flex-col items-start leading-tight">
            <span className="max-w-full truncate">{label}</span>
            {subLabel && <span className="max-w-full truncate text-sm font-semibold opacity-85">{subLabel}</span>}
          </span>
        </Button>
        {/* Freestyle, after a game: pick a different one (small, styled like Skip; asks first). */}
        {canChangeGame && (
          <Button variant="outline" className={SMALL} onClick={() => setConfirmChange(true)} disabled={Boolean(busy)} aria-label="Choose another game" title="Choose another game">
            <Shuffle /> Change
          </Button>
        )}
      </div>
      <Dialog open={confirmChange} onOpenChange={setConfirmChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choose another game?</DialogTitle>
            <DialogDescription>You'll go to the game library to pick a different game. Players stay in the room.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmChange(false)}>
              Keep this game
            </Button>
            <Button onClick={() => navigate(`/host/${roomId}/games`)}>
              <Shuffle /> Choose another
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {playedSome && !compact && (
        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Gamepad2 className="size-4" /> The leaderboard is showing on the display.
        </p>
      )}
    </div>
  );
}

/** Small square button: icon over a short label (same shape as the lobby's quick actions). */
const SMALL = "h-16 w-14 shrink-0 flex-col gap-0.5 rounded-md px-0 text-[11px] font-bold xs:w-16";

const PHASE_LABEL = { intro: "How to play", question: "Answering", reveal: "Results" } as const;

function LiveGameControls({
  room,
  roomId,
  gameId,
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
  gameId: GameId;
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
  const [confirmEnd, setConfirmEnd] = useState(false);
  const isTournament = room.gameMode === "tournament";
  const control = (action: GameControlAction) => run(action, () => call("controlGame", { roomId, action }));
  const gameAction = (name: string) => run(`game:${name}`, () => call("controlGame", { roomId, action: "game", name }));
  // Games can rename the main action or swap in their own (e.g. The Impostor's Revote / Reveal).
  const custom = live ? getGame(gameId).hostControls?.(live) : undefined;
  const defaultNext = !live ? "Next" : live.phase === "intro" ? "Start round 1" : live.phase === "question" ? "Reveal now" : live.round >= live.totalRounds ? "Show results" : "Next round";
  const nextLabel = custom?.main?.label ?? custom?.nextLabel ?? defaultNext;
  const stepLabel = !live ? "" : live.phase === "intro" ? PHASE_LABEL.intro : live.roundLabel ?? `Round ${live.round}/${live.totalRounds} · ${PHASE_LABEL[live.phase]}`;

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
            <span className="min-w-0 truncate">{stepLabel}</span>
            {live.phase === "question" && live.eligible > 1 && (
              <span className="flex items-center gap-1 tabular-nums text-muted-foreground">
                <Users className="size-4" /> {live.submitted}/{live.eligible} answered
              </span>
            )}
          </div>
          {/* Games that hide the round clock from players (Perfectly Hold) hide it here too: the host's screen is often in view. */}
          {!(live.phase === "question" && getGame(gameId).showTimer === false) && (
            <TimerBar endsAtMs={live.phaseEndsAtMs} durationMs={live.phaseDurationMs} paused={live.paused} remainingMs={live.remainingMs} />
          )}
        </div>
      )}
      {/* End · Pause · Skip as small buttons, then the main action. Skip stays in place
          (disabled) outside questions so the buttons never shift under the host's thumb. */}
      <div className="flex gap-2">
        <Button variant="destructive" className={SMALL} onClick={() => setConfirmEnd(true)} disabled={Boolean(busy)}>
          {icon("end", Flag)} End
        </Button>
        {live?.paused ? (
          // Resume keeps its original blue so it stands out from Pause and the yellow main action.
          <Button className={cn(SMALL, "bg-[oklch(0.66_0.2_255)] text-white hover:brightness-110")} onClick={() => control("resume")} disabled={Boolean(busy)}>
            {icon("resume", Play)} Resume
          </Button>
        ) : (
          <Button variant="secondary" className={SMALL} onClick={() => control("pause")} disabled={Boolean(busy) || !live}>
            {icon("pause", Pause)} Pause
          </Button>
        )}
        {custom?.skip ? (
          <Button variant="outline" className={SMALL} onClick={() => gameAction(custom.skip!.name)} disabled={Boolean(busy) || !live || live.paused} aria-label={custom.skip.label}>
            {icon(`game:${custom.skip.name}`, Eye)} <span className="max-w-full truncate px-0.5">{custom.skip.label}</span>
          </Button>
        ) : (
          <Button
            variant="outline"
            className={SMALL}
            onClick={() => control("skip")}
            disabled={Boolean(busy) || live?.phase !== "question" || live.paused || live.skippable === false}
            aria-label="Skip round"
            title="Skip this question without scoring"
          >
            {icon("skip", SkipForward)} Skip
          </Button>
        )}
        {/* Wraps to two lines rather than truncating; the icon drops on the narrowest phones. */}
        <Button
          size="xl"
          variant="party"
          className="min-w-0 flex-1 gap-2 px-3 text-base leading-tight whitespace-normal sm:text-lg"
          onClick={() => (custom?.main ? gameAction(custom.main.name) : control("next"))}
          disabled={Boolean(busy) || !live || live.paused}
        >
          <span className="hidden xs:contents">{custom?.main ? icon(`game:${custom.main.name}`, RotateCcw) : icon("next", FastForward)}</span>
          <span className="text-center">{nextLabel}</span>
        </Button>
      </div>

      <Dialog open={confirmEnd} onOpenChange={setConfirmEnd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>End {gameName}?</DialogTitle>
            <DialogDescription>The game stops now and results are based on the points so far. This can't be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmEnd(false)}>
              Keep playing
            </Button>
            <Button
              variant="destructive"
              disabled={Boolean(busy)}
              onClick={async () => {
                await end();
                setConfirmEnd(false);
              }}
            >
              {icon("end", Flag)} End game
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
