import { useState } from "react";
import { Loader2, LogOut, Repeat, Trophy } from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Backdrop } from "@/components/shared/Backdrop";
import { BottomBar } from "@/components/shared/BottomBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePlayers } from "@/hooks/useRoomData";
import { call, errorMessage } from "@/services/firebase";
import { HostHeader } from "../components/HostHeader";
import { HostControls } from "../components/HostControls";
import { DisplayPairingCard } from "../components/DisplayPairingCard";
import { LineupCard } from "../components/LineupCard";
import { PlayerListCard } from "../components/PlayerListCard";
import { RoomCodeCard } from "../components/RoomCodeCard";
import { useHostContext } from "../HostRoomLayout";
import { clearLastHostedRoom } from "../hostSession";

export function HostLobbyScreen() {
  const { room, user } = useHostContext();
  const players = usePlayers(room.id);
  const navigate = useNavigate();
  const [confirmClose, setConfirmClose] = useState(false);
  const [closing, setClosing] = useState(false);
  const isTournament = room.gameMode === "tournament";

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
      <main className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 sm:pt-8 lg:pb-10">
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

        {/* Mobile: single column. Tablet landscape+: players left, room controls right. */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-[1fr_24rem] xl:grid-cols-[1fr_26rem]">
          <div className="order-2 min-w-0 space-y-4 sm:space-y-5 lg:order-1">
            <PlayerListCard roomId={room.id} players={players.data} loading={players.status === "loading"} showScores={isTournament && room.currentGameIndex > 0} />
          </div>
          <div className="order-1 min-w-0 space-y-4 sm:space-y-5 lg:order-2">
            <RoomCodeCard roomCode={room.roomCode} roomName={room.roomName} />
            <div className="hidden lg:block">
              <HostControls room={room} roomId={room.id} />
            </div>
            <DisplayPairingCard roomId={room.id} hostId={user.uid} />
            <LineupCard room={room} roomId={room.id} />
          </div>
        </div>

        <BottomBar className="lg:hidden">
          <HostControls room={room} roomId={room.id} />
        </BottomBar>
      </main>

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
