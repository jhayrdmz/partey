import { useEffect } from "react";
import { Home, Lock } from "lucide-react";
import { Link, Outlet, useLocation, useNavigate, useOutletContext, useParams } from "react-router";
import type { User } from "firebase/auth";
import type { RoomDoc } from "@shared/types";
import { Button } from "@/components/ui/button";
import { ConnectionBanner } from "@/components/shared/ConnectionBanner";
import { LoadingScreen, ScreenState } from "@/components/shared/ScreenState";
import { useAuthUser } from "@/hooks/useAuthUser";
import { usePresence } from "@/hooks/usePresence";
import { useRoom } from "@/hooks/useRoomData";
import type { WithId } from "@/services/firebase";
import { saveLastHostedRoom } from "./hostSession";

export interface HostContext {
  room: WithId<RoomDoc>;
  user: User;
}

export function useHostContext() {
  return useOutletContext<HostContext>();
}

/**
 * Wraps all /host/:roomId screens: authenticates, subscribes to the room once,
 * verifies host ownership, keeps host presence alive and routes to the right setup step.
 */
export function HostRoomLayout() {
  const { roomId } = useParams<{ roomId: string }>();
  const { user, status: authStatus, error: authError } = useAuthUser();
  const room = useRoom(roomId, Boolean(user));
  const isHost = Boolean(user && room.data && room.data.hostId === user.uid);
  const realtimeConnected = usePresence(roomId, user?.uid, "host", isHost);
  const location = useLocation();
  const navigate = useNavigate();

  const data = room.data;
  useEffect(() => {
    if (!data || !isHost) return;
    saveLastHostedRoom({ roomId: data.id, roomName: data.roomName, roomCode: data.roomCode });
    const base = `/host/${data.id}`;
    const onMode = location.pathname.endsWith("/mode");
    const onGames = location.pathname.endsWith("/games");
    if (!data.gameMode && !onMode) navigate(`${base}/mode`, { replace: true });
    else if (data.gameMode && data.lineup.length === 0 && !onMode && !onGames && data.status === "waiting") {
      navigate(`${base}/games`, { replace: true });
    }
  }, [data, isHost, location.pathname, navigate]);

  if (authStatus === "error") return <ScreenState tone="error" title="Couldn't sign in" message={authError} />;
  if (!user || room.status === "loading") return <LoadingScreen label="Opening your room…" />;

  if (room.status === "error" || !data || !isHost) {
    return (
      <ScreenState
        icon={Lock}
        title="Room unavailable"
        message="This room has ended, expired, or belongs to another host device."
        action={
          <>
            <Button asChild size="lg">
              <Link to="/host">Create a new room</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/">
                <Home /> Home
              </Link>
            </Button>
          </>
        }
      />
    );
  }

  return (
    <>
      <ConnectionBanner realtimeConnected={realtimeConnected} />
      <Outlet context={{ room: data, user } satisfies HostContext} />
    </>
  );
}
