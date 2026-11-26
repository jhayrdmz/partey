import { useEffect, useState } from "react";
import { ArrowRight, History, Loader2, PartyPopper } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { LIMITS, cleanName } from "@shared/constants";
import { Backdrop } from "@/components/shared/Backdrop";
import { BottomBar } from "@/components/shared/BottomBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthUser } from "@/hooks/useAuthUser";
import { call, errorMessage } from "@/services/firebase";
import { HostHeader } from "../components/HostHeader";
import { saveLastHostedRoom, verifyLastHostedRoom, type LastHostedRoom } from "../hostSession";

const SUGGESTIONS = ["Friday Game Night", "Barkada Showdown", "Noche Buena Games", "Office Partey"];

export function CreateRoomScreen() {
  const [roomName, setRoomName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuthUser();
  // Only offer "Rejoin as host" once the server confirms the room is still live.
  const [lastRoom, setLastRoom] = useState<LastHostedRoom | null>(null);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void verifyLastHostedRoom(user.uid).then((room) => !cancelled && setLastRoom(room));
    return () => {
      cancelled = true;
    };
  }, [user]);
  const trimmed = roomName.trim();
  const valid = trimmed.length >= LIMITS.roomNameMin;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || submitting) return;
    setSubmitting(true);
    try {
      const { roomId, roomCode } = await call("createRoom", { roomName: trimmed });
      saveLastHostedRoom({ roomId, roomCode, roomName: trimmed });
      navigate(`/host/${roomId}/mode`);
    } catch (err) {
      toast.error(errorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <Backdrop>
      <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-4 pt-4 sm:px-6 sm:pt-8">
        <HostHeader step="Room" backTo="/" title="Create a room" subtitle="Give your party a name. You'll pick games next." />

        <form onSubmit={handleSubmit} className="mt-8 flex flex-1 flex-col">
          <div className="space-y-3">
            <Label htmlFor="room-name">Room name</Label>
            <Input
              id="room-name"
              autoFocus
              autoComplete="off"
              enterKeyHint="go"
              placeholder="e.g. Friday Game Night"
              maxLength={LIMITS.roomNameMax}
              value={roomName}
              onChange={(e) => setRoomName(cleanName(e.target.value, LIMITS.roomNameMax))}
              aria-describedby="room-name-hint"
            />
            <p id="room-name-hint" className="text-sm text-muted-foreground">
              Letters and numbers only, up to {LIMITS.roomNameMax} characters.
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setRoomName(s)}
                  className="min-h-10 rounded-md border border-border bg-secondary/50 px-3.5 text-sm font-semibold text-muted-foreground transition hover:border-primary/60 hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {lastRoom && (
            <Link
              to={`/host/${lastRoom.roomId}`}
              className="mt-8 flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition hover:border-primary/60"
            >
              <span className="grid size-11 place-items-center rounded-xl bg-secondary text-sky">
                <History className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-muted-foreground">Rejoin as host</span>
                <span className="block truncate font-bold">
                  {lastRoom.roomName} · {lastRoom.roomCode}
                </span>
              </span>
              <ArrowRight className="size-5 text-muted-foreground" />
            </Link>
          )}

          <div className="flex-1" />
          <BottomBar className="sm:mt-10 sm:mb-10">
            <Button type="submit" size="xl" className="w-full" disabled={!valid || submitting}>
              {submitting ? <Loader2 className="animate-spin" /> : <PartyPopper />}
              {submitting ? "Creating room…" : "Continue"}
            </Button>
          </BottomBar>
        </form>
      </main>
    </Backdrop>
  );
}
