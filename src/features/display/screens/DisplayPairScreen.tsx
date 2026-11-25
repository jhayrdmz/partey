import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, MonitorUp, RotateCcw, ShieldCheck, Smartphone, Tv } from "lucide-react";
import { motion } from "motion/react";
import { Link, useNavigate } from "react-router";
import { PAIRING_CODE_LENGTH } from "@shared/constants";
import { Backdrop } from "@/components/shared/Backdrop";
import { CodeInput } from "@/components/shared/CodeInput";
import { Logo } from "@/components/shared/Logo";
import { Button } from "@/components/ui/button";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useLiveDoc } from "@/hooks/useFirestore";
import { call, errorMessage, refs } from "@/services/firebase";
import { defaultDisplayLabel } from "@/utils/device";
import { unlockAudio } from "@/utils/sound";
import { lastDisplayRoom, rememberDisplayRoom } from "../displaySession";

const STEPS = [
  { icon: Smartphone, text: "On the host's device, open the room lobby and tap “Connect a display”." },
  { icon: MonitorUp, text: "Type the 6-digit pairing code here." },
  { icon: ShieldCheck, text: "The host approves this screen — and you're live." },
];

export function DisplayPairScreen() {
  const { user, status: authStatus, error: authError } = useAuthUser();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pairingId, setPairingId] = useState<string | null>(null);
  const pairing = useLiveDoc(pairingId ? refs.pairing(pairingId) : null, pairingId ?? "off");
  const previousRoom = lastDisplayRoom();

  async function connect(value = code) {
    if (value.length !== PAIRING_CODE_LENGTH || submitting || !user) return;
    unlockAudio(); // the click is our user gesture for later sound effects
    setSubmitting(true);
    setError(null);
    try {
      const res = await call("requestDisplayPairing", { code: value, label: defaultDisplayLabel() });
      setPairingId(res.pairingId);
    } catch (err) {
      setError(errorMessage(err));
      setCode("");
    } finally {
      setSubmitting(false);
    }
  }

  const status = pairing.data?.status;
  const roomId = pairing.data?.roomId;
  useEffect(() => {
    if (status === "approved" && roomId) {
      rememberDisplayRoom(roomId);
      const t = window.setTimeout(() => navigate(`/display/${roomId}`, { replace: true }), 900);
      return () => window.clearTimeout(t);
    }
  }, [status, roomId, navigate]);

  // Waiting-for-approval expiry (the host has a limited window to approve).
  const expiresAt = pairing.data?.expiresAt?.toMillis();
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    if (!expiresAt || status !== "requested") return;
    const t = window.setTimeout(() => setExpired(true), Math.max(0, expiresAt - Date.now()));
    return () => window.clearTimeout(t);
  }, [expiresAt, status]);

  const reset = () => {
    setPairingId(null);
    setExpired(false);
    setCode("");
    setError(null);
  };

  let panel: React.ReactNode;
  if (pairingId && (status === "requested" || pairing.status === "loading") && !expired) {
    panel = (
      <div className="flex flex-col items-center gap-6 text-center" role="status" aria-live="polite">
        <div className="relative grid size-28 place-items-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-sky/30" />
          <span className="relative grid size-24 place-items-center rounded-full bg-sky/20">
            <Tv className="size-12 text-sky" />
          </span>
        </div>
        <div className="space-y-2">
          <h2 className="text-3xl font-extrabold lg:text-4xl">Waiting for the host…</h2>
          <p className="text-lg text-muted-foreground">Ask the host to tap <span className="font-bold text-foreground">Approve</span> on their device.</p>
        </div>
        <Button variant="ghost" onClick={reset}>
          <RotateCcw className="size-4" /> Use a different code
        </Button>
      </div>
    );
  } else if (status === "approved") {
    panel = (
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center gap-4 text-center">
        <CheckCircle2 className="size-24 text-success" />
        <h2 className="text-3xl font-extrabold lg:text-4xl">Connected!</h2>
        <p className="text-lg text-muted-foreground">Loading the game room…</p>
      </motion.div>
    );
  } else if (pairingId && (status === "rejected" || expired || pairing.status === "error")) {
    panel = (
      <div className="flex flex-col items-center gap-4 text-center">
        <h2 className="text-3xl font-extrabold">{status === "rejected" ? "The host declined" : "Request expired"}</h2>
        <p className="text-lg text-muted-foreground">Ask the host for a new pairing code and try again.</p>
        <Button size="lg" onClick={reset}>
          <RotateCcw /> Try again
        </Button>
      </div>
    );
  } else {
    panel = (
      <form
        className="flex w-full flex-col items-center gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          void connect();
        }}
      >
        <div className="space-y-2 text-center">
          <h2 className="text-3xl font-extrabold lg:text-4xl">Enter pairing code</h2>
          <p className="text-lg text-muted-foreground">The host's device shows a 6-digit code.</p>
        </div>
        <CodeInput
          value={code}
          onChange={(v) => {
            setCode(v);
            setError(null);
          }}
          length={PAIRING_CODE_LENGTH}
          autoFocus
          invalid={Boolean(error)}
          disabled={submitting || authStatus !== "ready"}
          label="Display pairing code"
          onComplete={(v) => void connect(v)}
        />
        <p className="min-h-6 text-center font-semibold text-destructive" role="alert">
          {error ?? (authStatus === "error" ? authError : null)}
        </p>
        <Button type="submit" size="xl" variant="accent" className="w-full max-w-sm" disabled={code.length !== PAIRING_CODE_LENGTH || submitting || !user}>
          {submitting ? <Loader2 className="animate-spin" /> : <Tv />} {submitting ? "Connecting…" : "Connect"}
        </Button>
        {previousRoom && (
          <Link to={`/display/${previousRoom}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-sky underline-offset-4 hover:underline">
            Reconnect to the last room
          </Link>
        )}
      </form>
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
        </section>
        <section className="glass min-w-0 rounded-3xl border p-4 sm:p-10">{panel}</section>
      </main>
    </Backdrop>
  );
}
