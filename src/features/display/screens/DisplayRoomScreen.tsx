import { useEffect, useRef, useState } from "react";
import { MonitorX, Tv } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Link, useParams } from "react-router";
import { Backdrop } from "@/components/shared/Backdrop";
import { ConnectionBanner } from "@/components/shared/ConnectionBanner";
import { LoadingScreen, ScreenState } from "@/components/shared/ScreenState";
import { Button } from "@/components/ui/button";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useLiveDoc } from "@/hooks/useFirestore";
import { usePresence } from "@/hooks/usePresence";
import { useDisplayState, usePlayers, useRoom } from "@/hooks/useRoomData";
import { fetchDoc, refs } from "@/services/firebase";
import { playSound } from "@/utils/sound";
import { DisplayChrome } from "../components/DisplayChrome";
import { DisplayGameStage } from "../components/DisplayGameStage";
import { DisplayLobby } from "../components/DisplayLobby";
import { DisplayStandings } from "../components/DisplayStandings";
import { forgetDisplayRoom } from "../displaySession";

/**
 * The big screen. Connects to Firebase on its own (independent of the host's
 * browser) and only reads public presentation data: room, player profiles and
 * displayState. Authorisation = this device's uid has a non-revoked displaySession.
 */
export function DisplayRoomScreen() {
  const { roomId } = useParams<{ roomId: string }>();
  const { user, status: authStatus, error: authError } = useAuthUser();
  const session = useLiveDoc(user && roomId ? refs.displaySession(roomId, user.uid) : null, user && roomId ? `ds:${roomId}:${user.uid}` : "off");
  const authorised = Boolean(session.data && !session.data.revoked);
  const room = useRoom(roomId, authorised);
  const display = useDisplayState(roomId, authorised);
  const players = usePlayers(roomId, authorised);
  const realtimeConnected = usePresence(roomId, user?.uid, "display", authorised);

  // If room access is lost, re-read our session once to tell "revoked" from "room ended".
  const [revokedOnServer, setRevokedOnServer] = useState(false);
  const roomDenied = room.status === "error";
  useEffect(() => {
    if (!roomDenied || !user || !roomId) return;
    void fetchDoc(refs.displaySession(roomId, user.uid)).then((s) => setRevokedOnServer(Boolean(s?.revoked)));
  }, [roomDenied, user, roomId]);

  // Sound cues: player joined, game started, champion crowned.
  const prevCount = useRef<number | null>(null);
  useEffect(() => {
    if (players.status !== "ready") return;
    if (prevCount.current !== null && players.data.length > prevCount.current) playSound("join");
    prevCount.current = players.data.length;
  }, [players.data.length, players.status]);
  const screen = display.data?.currentScreen;
  const phase = display.data?.game?.phase;
  const roundNo = display.data?.game?.round;
  useEffect(() => {
    if (screen === "game" && phase === "intro") playSound("start");
    if (screen === "game" && phase === "question") playSound("pop");
    if (screen === "champion" || screen === "results" || screen === "leaderboard") playSound("win");
  }, [screen, phase, roundNo]);

  useEffect(() => {
    if (session.data?.revoked || revokedOnServer) forgetDisplayRoom();
  }, [session.data?.revoked, revokedOnServer]);

  if (authStatus === "error") return <ScreenState tone="error" title="Couldn't connect" message={authError} />;
  if (!user || session.status === "loading") return <LoadingScreen label="Connecting display…" />;

  if (!authorised || room.status === "error") {
    const revoked = session.data?.revoked || revokedOnServer;
    return (
      <ScreenState
        icon={revoked ? MonitorX : Tv}
        title={revoked ? "Display disconnected" : room.status === "error" ? "This room has ended" : "Display not paired"}
        message={revoked ? "The host disconnected this screen." : room.status === "error" ? "The room is closed or expired." : "Pair this screen with a room to show the game."}
        action={
          <Button asChild size="xl" variant="accent">
            <Link to="/display">
              <Tv /> Pair with a room
            </Link>
          </Button>
        }
      />
    );
  }
  if (room.status === "loading" || !room.data || display.status === "loading") return <LoadingScreen label="Loading the room…" />;

  const state = display.data;
  // A stale "game" screen (e.g. game ended while offline) falls back to the lobby.
  const current = room.data.status !== "playing" && state?.currentScreen === "game" ? "lobby" : (state?.currentScreen ?? "lobby");

  return (
    <Backdrop>
      <ConnectionBanner realtimeConnected={realtimeConnected} />
      <DisplayChrome hostOnline={room.data.hostConnected} />
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={{ duration: 0.35 }}
        >
          {current === "game" && state ? (
            <DisplayGameStage state={state} />
          ) : (current === "results" || current === "leaderboard" || current === "champion") && state ? (
            <DisplayStandings state={state} roomCode={room.data.roomCode} />
          ) : (
            <DisplayLobby room={room.data} players={players.data} />
          )}
        </motion.div>
      </AnimatePresence>
    </Backdrop>
  );
}
