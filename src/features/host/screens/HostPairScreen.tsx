import { useState } from "react";
import { Loader2, Tv } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { PAIRING_CODE_LENGTH } from "@shared/constants";
import { Backdrop } from "@/components/shared/Backdrop";
import { BottomBar } from "@/components/shared/BottomBar";
import { LoadingScreen, ScreenState } from "@/components/shared/ScreenState";
import { Button } from "@/components/ui/button";
import { useAuthUser } from "@/hooks/useAuthUser";
import { call, errorMessage } from "@/services/firebase";
import { HostHeader } from "../components/HostHeader";
import { loadLastHostedRoom } from "../hostSession";

/**
 * Opened when the host's phone scans the QR code on a display (/host/pair/:code).
 * Connects that display to the room this device is hosting, after one confirming tap
 * (so a stray or forged QR code can't attach a screen without the host noticing).
 */
export function HostPairScreen() {
  const { code = "" } = useParams<{ code: string }>();
  const { user, status: authStatus, error: authError } = useAuthUser();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const room = loadLastHostedRoom();
  const validCode = new RegExp(`^\\d{${PAIRING_CODE_LENGTH}}$`).test(code);

  if (!validCode) {
    return <ScreenState icon={Tv} tone="error" title="That link doesn't work" message="Scan the QR code on the display again, or type its code in your room lobby." />;
  }
  if (!room) {
    return (
      <ScreenState
        icon={Tv}
        title="No room open on this device"
        message="Create your room on this phone first, then scan the display's QR code again."
        action={
          <Button asChild size="lg">
            <Link to="/host">Create a room</Link>
          </Button>
        }
      />
    );
  }
  if (authStatus === "error") return <ScreenState tone="error" title="Couldn't sign in" message={authError} />;
  if (!user) return <LoadingScreen label="Getting ready…" />;

  async function connect() {
    if (!room || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await call("claimDisplayPairing", { roomId: room.roomId, code });
      toast.success(`${res.label} connected!`);
      navigate(`/host/${room.roomId}`, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <Backdrop>
      <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-4 pt-4 sm:px-6 sm:pt-8">
        <HostHeader backTo={`/host/${room.roomId}`} title="Connect this display?" subtitle="It will show your room's lobby, games and leaderboards." />

        <div className="mt-8 flex flex-1 flex-col">
          <div className="flex flex-col items-center gap-4 rounded-2xl border bg-card/70 p-6 text-center">
            <span className="grid size-16 place-items-center rounded-2xl bg-sky/15 text-sky">
              <Tv className="size-8" />
            </span>
            <p className="font-mono text-4xl font-extrabold tracking-[0.12em] text-white tabular-nums" aria-label={`Display code ${code.split("").join(" ")}`}>
              {code.slice(0, 3)} {code.slice(3)}
            </p>
            <p className="text-muted-foreground">
              Check this matches the code on the TV. It will join <span className="font-bold text-foreground">{room.roomName}</span>{" "}
              (<span className="font-mono font-bold tracking-widest text-foreground">{room.roomCode}</span>).
            </p>
          </div>
          {error && (
            <p className="mt-4 text-center font-semibold text-destructive" role="alert">
              {error}
            </p>
          )}

          <div className="flex-1" />
          <BottomBar className="sm:mt-10 sm:mb-10">
            <div className="flex gap-2">
              <Button asChild size="xl" variant="ghost" className="px-5">
                <Link to={`/host/${room.roomId}`}>Cancel</Link>
              </Button>
              <Button size="xl" variant="accent" className="min-w-0 flex-1" onClick={() => void connect()} disabled={submitting}>
                {submitting ? <Loader2 className="animate-spin" /> : <Tv />} Connect
              </Button>
            </div>
          </BottomBar>
        </div>
      </main>
    </Backdrop>
  );
}
