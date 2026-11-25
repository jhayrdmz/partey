import { useState } from "react";
import { Loader2, LogOut, QrCode, Repeat, Trophy, Tv } from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Backdrop } from "@/components/shared/Backdrop";
import { BottomBar } from "@/components/shared/BottomBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLiveQuery } from "@/hooks/useFirestore";
import { useDisplayState, usePlayers } from "@/hooks/useRoomData";
import { call, errorMessage, refs } from "@/services/firebase";
import { cn } from "@/utils/cn";
import { HostHeader } from "../components/HostHeader";
import { HostControls, type HostControlActions } from "../components/HostControls";
import { DisplayPairingCard } from "../components/DisplayPairingCard";
import { LineupCard } from "../components/LineupCard";
import { PlayerListCard } from "../components/PlayerListCard";
import { RoomCodeCard } from "../components/RoomCodeCard";
import { useHostContext } from "../HostRoomLayout";
import { clearLastHostedRoom } from "../hostSession";
import { joinUrlLabel } from "@/utils/urls";

export function HostLobbyScreen() {
  const { room } = useHostContext();
  const players = usePlayers(room.id);
  const display = useDisplayState(room.id);
  const live = room.status === "playing" ? display.data?.game : null;
  const navigate = useNavigate();
  const [confirmClose, setConfirmClose] = useState(false);
  const [closing, setClosing] = useState(false);
  const [sheet, setSheet] = useState<"code" | "display" | null>(null);
  const isTournament = room.gameMode === "tournament";
  const sessions = useLiveQuery(refs.displaySessions(room.id), `sessions:${room.id}`);
  const displayOnline = sessions.data.some((s) => !s.revoked && s.connected);

  // Room code and display pairing live in pop-ups, opened from beside the main action.
  const actions: HostControlActions = (placement) => (
    <>
      <QuickAction placement={placement} icon={QrCode} label="Code" title="Show room code" onClick={() => setSheet("code")} />
      <QuickAction placement={placement} icon={Tv} label="Display" title="Connect a display" onClick={() => setSheet("display")} dot={displayOnline} />
    </>
  );

  async function closeRoom() {
    setClosing(true);
    try {
      await call("closeRoom", { roomId: room.id });
      clearLastHostedRoom();
      navigate("/");
    } catch (err) {
      toast.error(errorMessage(err));
      setClosing(false);
    }
  }

  const statusBadge =
    room.status === "playing" ? <Badge variant="destructive">Live</Badge> : room.status === "finished" ? <Badge variant="warning">Finished</Badge> : <Badge variant="success">Lobby open</Badge>;

  return (
    <Backdrop confettiOn={false}>
      <main className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col px-4 pt-4 sm:px-6 sm:pt-8">
        <HostHeader
          step={room.status === "waiting" && room.currentGameIndex === 0 ? "Lobby" : undefined}
          title={room.roomName}
          subtitle={
            <span className="flex flex-wrap items-center gap-2">
              {statusBadge}
              <Badge variant="outline">
                {isTournament ? <Trophy /> : <Repeat />} {isTournament ? "Tournament" : "Freestyle"}
              </Badge>
              <span className="text-sm">{room.playerCount} player{room.playerCount === 1 ? "" : "s"}</span>
            </span>
          }
          right={
            <Button variant="ghost" size="sm" onClick={() => setConfirmClose(true)} className="text-muted-foreground" aria-label="End session">
              <LogOut className="size-4" /> <span className="hidden sm:inline">End session</span>
            </Button>
          }
        />

        {/* Lg+: players left, lineup right. Room code and display are in pop-ups (bottom bar). */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-[1fr_24rem] xl:grid-cols-[1fr_26rem]">
          <div className="min-w-0 space-y-4 sm:space-y-5">
            <PlayerListCard roomId={room.id} players={players.data} loading={players.status === "loading"} showScores={isTournament && room.currentGameIndex > 0} />
          </div>
          <div className="min-w-0 space-y-4 sm:space-y-5">
            <LineupCard room={room} roomId={room.id} />
          </div>
        </div>

        {/* Pushes the bar to the bottom when the lobby is short; sticky once it scrolls. */}
        <div className="flex-1" />
        {/* Same sticky bar on phones, tablets and desktop. */}
        <BottomBar always>
          <HostControls room={room} roomId={room.id} live={live} inBar actions={actions} />
        </BottomBar>
      </main>

      <Dialog open={sheet === "code"} onOpenChange={(open) => setSheet(open ? "code" : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite players</DialogTitle>
            <DialogDescription>Players scan the QR code or enter the room code at {joinUrlLabel()}.</DialogDescription>
          </DialogHeader>
          <RoomCodeCard roomCode={room.roomCode} roomName={room.roomName} stacked />
        </DialogContent>
      </Dialog>

      <Dialog open={sheet === "display"} onOpenChange={(open) => setSheet(open ? "display" : null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          {/* The card's own header is the visible title. */}
          <DialogTitle className="sr-only">Display</DialogTitle>
          <DialogDescription className="sr-only">Connect a TV or another screen to this room.</DialogDescription>
          <DisplayPairingCard roomId={room.id} bare />
        </DialogContent>
      </Dialog>

      <Dialog open={confirmClose} onOpenChange={setConfirmClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>End this session?</DialogTitle>
            <DialogDescription>The room closes for everyone, including players and displays. This can't be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmClose(false)}>
              Keep playing
            </Button>
            <Button variant="destructive" onClick={closeRoom} disabled={closing}>
              {closing && <Loader2 className="animate-spin" />} End session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Backdrop>
  );
}

/** Small square button beside the main action ("row"), or an icon button in a live game's header. */
function QuickAction({
  placement,
  icon: Icon,
  label,
  title,
  onClick,
  dot = false,
}: {
  placement: "row" | "header";
  icon: React.ElementType;
  label: string;
  title: string;
  onClick: () => void;
  dot?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="secondary"
      onClick={onClick}
      aria-label={title}
      title={title}
      className={cn(
        "relative shrink-0 px-0",
        placement === "row" ? "h-16 w-16 flex-col gap-0.5 rounded-md text-[11px] font-bold" : "size-10 rounded-md",
      )}
    >
      <Icon className={placement === "row" ? "size-6" : "size-5"} />
      {placement === "row" && <span>{label}</span>}
      {dot && <span aria-hidden className="absolute top-1.5 right-1.5 size-2.5 rounded-full bg-success ring-2 ring-secondary" />}
    </Button>
  );
}
