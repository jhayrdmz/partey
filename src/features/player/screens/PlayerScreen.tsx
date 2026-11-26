import { useCallback, useEffect, useState } from "react";
import { Home, Loader2, LogOut, SearchX, UserX } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import type { LookupRoomResponse } from "@shared/api";
import { ConnectionBanner } from "@/components/shared/ConnectionBanner";
import { LoadingScreen, ScreenState } from "@/components/shared/ScreenState";
import { Button } from "@/components/ui/button";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useLiveDoc } from "@/hooks/useFirestore";
import { usePresence } from "@/hooks/usePresence";
import { useActivityHeartbeat } from "@/hooks/useActivityHeartbeat";
import { useDisplayState, useRoom } from "@/hooks/useRoomData";
import { call, errorCode, errorMessage, refs } from "@/services/firebase";
import { playSound } from "@/utils/sound";
import { PlayerGameStage } from "../components/PlayerGameStage";
import { JoinForm } from "../components/JoinForm";
import { PlayerFrame } from "../components/PlayerFrame";
import { PlayerResults } from "../components/PlayerResults";
import { WaitingLobby } from "../components/WaitingLobby";

type Phase =
  | { kind: "lookup" }
  | { kind: "not-found"; message: string }
  | { kind: "kicked" }
  | { kind: "join"; room: LookupRoomResponse }
  | { kind: "joined"; roomId: string };

export function PlayerScreen() {
  const { roomCode: rawCode = "" } = useParams<{ roomCode: string }>();
  const roomCode = rawCode.toUpperCase();
  const { user, status: authStatus, error: authError } = useAuthUser();
  const [phase, setPhase] = useState<Phase>({ kind: "lookup" });
  const [joinError, setJoinError] = useState<string | null>(null);

  // Resolve the code → room. Already-joined players (refresh/reconnect) skip the form.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setPhase({ kind: "lookup" });
    call("lookupRoom", { roomCode })
      .then((room) => {
        if (cancelled) return;
        if (room.kicked) setPhase({ kind: "kicked" });
        else if (room.alreadyJoined) setPhase({ kind: "joined", roomId: room.roomId });
        else setPhase({ kind: "join", room });
      })
      .catch((err) => !cancelled && setPhase({ kind: "not-found", message: errorMessage(err) }));
    return () => {
      cancelled = true;
    };
  }, [user, roomCode]);

  const join = useCallback(
    async (nickname: string, avatar: string) => {
      setJoinError(null);
      try {
        const res = await call("joinRoom", { roomCode, nickname, avatar });
        playSound("join");
        setPhase({ kind: "joined", roomId: res.roomId });
      } catch (err) {
        const code = errorCode(err);
        if (code === "permission-denied") setPhase({ kind: "kicked" });
        else setJoinError(errorMessage(err));
      }
    },
    [roomCode],
  );

  if (authStatus === "error") return <ScreenState tone="error" title="Couldn't connect" message={authError} />;
  if (!user || phase.kind === "lookup") return <LoadingScreen label="Finding your room…" />;

  if (phase.kind === "not-found") {
    return (
      <ScreenState
        icon={SearchX}
        title="Room not found"
        message={phase.message}
        action={
          <Button asChild size="lg">
            <Link to="/play">Try another code</Link>
          </Button>
        }
      />
    );
  }
  if (phase.kind === "kicked") return <KickedScreen />;
  if (phase.kind === "join") {
    return (
      <PlayerFrame>
        <JoinForm roomCode={roomCode} roomName={phase.room.roomName} playerCount={phase.room.playerCount} onJoin={join} error={joinError} />
      </PlayerFrame>
    );
  }
  return <PlayerSession key={phase.roomId} roomId={phase.roomId} roomCode={roomCode} uid={user.uid} />;
}

function KickedScreen() {
  return (
    <ScreenState
      icon={UserX}
      title="You were removed"
      message="The host removed you from this room."
      action={
        <Button asChild size="lg" variant="outline">
          <Link to="/">
            <Home /> Home
          </Link>
        </Button>
      }
    />
  );
}

/** Live session for a joined player: one listener each for self, room and public display state. */
function PlayerSession({ roomId, roomCode, uid }: { roomId: string; roomCode: string; uid: string }) {
  const navigate = useNavigate();
  const me = useLiveDoc(refs.player(roomId, uid), `me:${roomId}:${uid}`);
  const active = me.data?.status === "online" || me.data?.status === "offline";
  const room = useRoom(roomId, active);
  const lostAccess = useAccessCheck(roomCode, room.status === "error");
  const display = useDisplayState(roomId, active);
  const realtimeConnected = usePresence(roomId, uid, "player", active);
  // Players using the app count as lobby activity too.
  useActivityHeartbeat(roomId, active);
  const [leaving, setLeaving] = useState(false);

  async function leave() {
    setLeaving(true);
    try {
      await call("leaveRoom", { roomId });
      navigate("/");
    } catch (err) {
      toast.error(errorMessage(err));
      setLeaving(false);
    }
  }

  // The room ended (host closed it, it expired, or the host's slot expired): back to the code screen.
  const kicked = me.data?.status === "kicked" || lostAccess === "kicked";
  const ended =
    !kicked &&
    me.status !== "loading" &&
    lostAccess !== "checking" &&
    (me.status === "error" || room.status === "error" || !me.data || me.data.status === "left" || room.data?.status === "expired");
  useEffect(() => {
    if (!ended) return;
    toast("This room has ended", { id: "room-ended", description: "Enter a code to join another room." });
    navigate("/play", { replace: true });
  }, [ended, navigate]);

  if (me.status === "loading" || lostAccess === "checking") return <LoadingScreen label="Rejoining…" />;
  if (me.data?.status === "kicked" || lostAccess === "kicked") return <KickedScreen />;
  if (ended) return <LoadingScreen label="This room has ended…" />;
  if (room.status === "loading" || !room.data || !me.data) return <LoadingScreen label="Rejoining…" />;

  const screen = display.data?.currentScreen ?? "lobby";
  const showResults = (screen === "results" || screen === "leaderboard" || screen === "champion") && display.data;

  return (
    <>
      <ConnectionBanner realtimeConnected={realtimeConnected} />
      <PlayerFrame
        nickname={me.data.nickname}
        avatar={me.data.avatar}
        score={room.data.gameMode === "tournament" && room.data.status !== "playing" ? me.data.score : undefined}
        right={
          room.data.status === "waiting" && (
            <Button size="icon-sm" variant="ghost" aria-label="Leave room" onClick={leave} disabled={leaving}>
              {leaving ? <Loader2 className="animate-spin" /> : <LogOut className="text-muted-foreground" />}
            </Button>
          )
        }
      >
        {room.data.status === "playing" && display.data && screen === "game" ? (
          <PlayerGameStage roomId={roomId} uid={uid} state={display.data} />
        ) : showResults ? (
          <PlayerResults state={display.data!} playerId={uid} />
        ) : (
          <WaitingLobby room={room.data} nickname={me.data.nickname} avatar={me.data.avatar} />
        )}
      </PlayerFrame>
    </>
  );
}

/**
 * When the room listener loses permission, ask the server why: the player was
 * removed, or the room ended/expired. (Listener updates for one's own record
 * may not arrive once membership is revoked, so don't rely on them.)
 */
function useAccessCheck(roomCode: string, denied: boolean): "ok" | "checking" | "kicked" | "ended" {
  const [result, setResult] = useState<"ok" | "checking" | "kicked" | "ended">("ok");
  useEffect(() => {
    if (!denied) return;
    let cancelled = false;
    setResult("checking");
    call("lookupRoom", { roomCode })
      .then((r) => !cancelled && setResult(r.kicked ? "kicked" : r.alreadyJoined ? "ok" : "ended"))
      .catch(() => !cancelled && setResult("ended"));
    return () => {
      cancelled = true;
    };
  }, [denied, roomCode]);
  return result;
}
