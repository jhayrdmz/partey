import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, KeyRound, Loader2, RefreshCw, Smartphone, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { QRCodeSVG } from "qrcode.react";
import { Link, useNavigate } from "react-router";
import type { CreateDisplayCodeResponse } from "@shared/api";
import { Backdrop } from "@/components/shared/Backdrop";
import { Logo } from "@/components/shared/Logo";
import { Button } from "@/components/ui/button";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useCountdown } from "@/hooks/useCountdown";
import { useLiveDoc } from "@/hooks/useFirestore";
import { call, errorMessage, refs } from "@/services/firebase";
import { defaultDisplayLabel } from "@/utils/device";
import { unlockAudioOnFirstGesture } from "@/utils/sound";
import { displayPairUrl } from "@/utils/urls";
import { MEDIA, mediaUrl } from "@/utils/media";
import { useSoundStore } from "@/stores/soundStore";
import { lastDisplayRoom, rememberDisplayRoom } from "../displaySession";
import { useGameMusic } from "../useGameMusic";

const STEPS = [
  { icon: Smartphone, text: "On the host's phone, open the room lobby and tap Display, next to Start." },
  { icon: KeyRound, text: "Type the 6-digit code shown here, or tap Scan QR code and point the camera at this screen." },
  { icon: Sparkles, text: "This screen switches to the game automatically. No approval needed." },
];

/** Refresh a little before the code expires, so the host never types a dead code. */
const REFRESH_EARLY_MS = 3000;

interface Ticket extends CreateDisplayCodeResponse {
  /** Local time when the code should be replaced (clock-skew safe: based on the code's lifetime). */
  refreshAtMs: number;
}

function formatSeconds(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * The display asks the server for a short-lived code and shows it with a QR code.
 * The host enters (or scans) it to connect this screen to their room.
 */
export function DisplayPairScreen() {
  const { user, status: authStatus, error: authError } = useAuthUser();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inFlight = useRef(false);
  const pairing = useLiveDoc(ticket ? refs.pairing(ticket.pairingId) : null, ticket?.pairingId ?? "off");
  const previousRoom = lastDisplayRoom();

  useEffect(() => unlockAudioOnFirstGesture(), []);
  // Waiting-for-host music; the same track carries on into the room lobby once paired.
  const muted = useSoundStore((s) => s.muted);
  useGameMusic(mediaUrl(MEDIA.lobbyMusic), !muted);

  const requestCode = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setError(null);
    try {
      const res = await call("createDisplayCode", { label: defaultDisplayLabel() });
      const now = Date.now();
      // The server's expiry is in server time; use the code's lifetime instead so a wrong TV clock can't cause a refresh loop.
      const lifetimeMs = Math.min(Math.max(res.expiresAtMs - now, 30_000), 30 * 60_000);
      setTicket({ ...res, refreshAtMs: now + lifetimeMs - REFRESH_EARLY_MS });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, []);

  // First code once signed in.
  useEffect(() => {
    if (user && !ticket && !error) void requestCode();
  }, [user, ticket, error, requestCode]);

  // Replace the code before it expires.
  const status = pairing.data?.status;
  useEffect(() => {
    if (!ticket || status === "approved") return;
    const t = window.setTimeout(() => void requestCode(), Math.max(0, ticket.refreshAtMs - Date.now()));
    return () => window.clearTimeout(t);
  }, [ticket, status, requestCode]);

  // Claimed by a host: open the room.
  const roomId = pairing.data?.roomId;
  useEffect(() => {
    if (status === "approved" && roomId) {
      rememberDisplayRoom(roomId);
      const t = window.setTimeout(() => navigate(`/display/${roomId}`, { replace: true }), 900);
      return () => window.clearTimeout(t);
    }
  }, [status, roomId, navigate]);

  const remaining = useCountdown(ticket?.refreshAtMs);

  let panel: React.ReactNode;
  if (status === "approved") {
    panel = (
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center gap-4 py-8 text-center">
        <CheckCircle2 className="size-24 text-success" />
        <h2 className="text-3xl font-extrabold lg:text-4xl">Connected!</h2>
        <p className="text-lg text-muted-foreground">Loading the game room…</p>
      </motion.div>
    );
  } else if (error || authStatus === "error") {
    panel = (
      <div className="flex flex-col items-center gap-4 py-8 text-center" role="alert">
        <h2 className="text-3xl font-extrabold">Couldn't get a code</h2>
        <p className="text-lg text-muted-foreground">{error ?? authError}</p>
        <Button size="lg" onClick={() => void requestCode()} disabled={loading || !user}>
          {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />} Try again
        </Button>
      </div>
    );
  } else if (!ticket) {
    panel = (
      <div className="flex flex-col items-center gap-4 py-16 text-muted-foreground" role="status" aria-live="polite">
        <Loader2 className="size-10 animate-spin text-sky" />
        <span className="text-lg font-semibold">Getting a pairing code…</span>
      </div>
    );
  } else {
    const replaced = status === "cancelled";
    panel = (
      <div className="flex flex-col items-center gap-5 text-center lg:gap-6">
        <div className="space-y-1.5">
          <h2 className="text-2xl font-extrabold lg:text-3xl">Enter this code on the host's device</h2>
          <p className="text-muted-foreground lg:text-lg">
            Tap <span className="font-bold text-foreground">Display</span> in the room lobby, then type it in.
          </p>
        </div>
        <p
          className="font-mono text-5xl font-extrabold whitespace-nowrap text-white tabular-nums tracking-[0.12em] sm:text-7xl lg:text-6xl xl:text-7xl"
          aria-label={`Pairing code ${ticket.code.split("").join(" ")}`}
          aria-live="polite"
        >
          {ticket.code.slice(0, 3)} {ticket.code.slice(3)}
        </p>
        <div className="flex w-full items-center gap-3 text-sm font-semibold text-muted-foreground" aria-hidden>
          <span className="h-px flex-1 bg-border" /> or scan this QR code <span className="h-px flex-1 bg-border" />
        </div>
        <div className="bg-white p-3">
          <QRCodeSVG
            value={displayPairUrl(ticket.code)}
            size={176}
            level="M"
            bgColor="#ffffff"
            fgColor="#0b0b24"
            title="Scan with the host's phone to connect this display"
            className="block size-36 sm:size-44"
          />
        </div>
        {replaced ? (
          <Button variant="outline" onClick={() => void requestCode()} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : <RefreshCw className="size-4" />} This code was replaced. Get a new one
          </Button>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground tabular-nums">
            <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
            {loading ? "Getting a new code…" : `New code in ${formatSeconds(remaining ?? 0)}`}
          </p>
        )}
      </div>
    );
  }

  return (
    <Backdrop>
      <main className="mx-auto grid min-h-dvh w-full max-w-7xl grid-cols-1 items-center gap-10 px-4 py-8 sm:px-8 lg:grid-cols-2 lg:gap-16 lg:px-12">
        <section className="min-w-0 space-y-8">
          <Link to="/" aria-label="Partey home" className="block w-fit">
            <Logo size="xl" tagline />
          </Link>
          <div className="space-y-2">
            <p className="text-2xl font-bold lg:text-3xl">Connect this screen</p>
            <p className="text-lg text-muted-foreground lg:text-xl">Turn this TV, monitor or tablet into the game display.</p>
          </div>
          <ol className="hidden space-y-4 sm:block">
            {STEPS.map(({ icon: Icon, text }, i) => (
              <li key={i} className="flex items-start gap-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-secondary text-sky">
                  <Icon className="size-6" />
                </span>
                <span className="pt-2.5 text-lg text-foreground/90">{text}</span>
              </li>
            ))}
          </ol>
          {previousRoom && (
            <Link to={`/display/${previousRoom}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-sky underline-offset-4 hover:underline">
              Reconnect to the last room
            </Link>
          )}
        </section>
        <section className="glass min-w-0 rounded-3xl border p-4 sm:p-10">{panel}</section>
      </main>
    </Backdrop>
  );
}
