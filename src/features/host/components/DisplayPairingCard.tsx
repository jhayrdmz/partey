import { useState } from "react";
import { Loader2, Plus, Tv, Unplug } from "lucide-react";
import { toast } from "sonner";
import { PAIRING_CODE_LENGTH } from "@shared/constants";
import type { DisplaySessionDoc } from "@shared/types";
import { CodeInput } from "@/components/shared/CodeInput";
import { StatusPill } from "@/components/shared/StatusPill";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLiveQuery } from "@/hooks/useFirestore";
import { call, errorMessage, refs } from "@/services/firebase";
import { displayUrlLabel } from "@/utils/urls";

/** Host-side display management: enter the code shown on a display to connect it, revoke displays. */
export function DisplayPairingCard({ roomId }: { roomId: string }) {
  const sessions = useLiveQuery(refs.displaySessions(roomId), `sessions:${roomId}`);
  const [busy, setBusy] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const active = sessions.data.filter((s: DisplaySessionDoc) => !s.revoked);
  // First display: show the code entry right away. Afterwards it's one tap away.
  const showEntry = active.length === 0 || adding;

  async function connect(value = code) {
    if (value.length !== PAIRING_CODE_LENGTH || busy) return;
    setBusy("connect");
    setError(null);
    try {
      const res = await call("claimDisplayPairing", { roomId, code: value });
      toast.success(`${res.label} connected!`);
      setCode("");
      setAdding(false);
    } catch (err) {
      setError(errorMessage(err));
      setCode("");
    } finally {
      setBusy(null);
    }
  }

  async function revoke(displayId: string) {
    setBusy(`revoke:${displayId}`);
    try {
      await call("revokeDisplay", { roomId, displayId });
      toast.success("Display disconnected");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-extrabold">
          <Tv className="size-5 text-sky" /> Display
        </h2>
        <StatusPill
          online={active.some((s) => s.connected)}
          onlineLabel={`${active.filter((s) => s.connected).length} connected`}
          offlineLabel={active.length ? "Display offline" : "Not connected"}
        />
      </div>

      {showEntry ? (
        <form
          className="space-y-3 rounded-xl bg-secondary/50 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void connect();
          }}
        >
          <p className="text-sm text-muted-foreground">
            On the TV, open <span className="font-bold break-all text-foreground">{displayUrlLabel()}</span>, then enter the code it shows. Or scan its QR code
            with this phone.
          </p>
          <CodeInput
            value={code}
            onChange={(v) => {
              setCode(v);
              setError(null);
            }}
            length={PAIRING_CODE_LENGTH}
            invalid={Boolean(error)}
            disabled={busy === "connect"}
            label="Code shown on the display"
            onComplete={(v) => void connect(v)}
          />
          {error && (
            <p className="text-center text-sm font-semibold text-destructive" role="alert">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            {active.length > 0 && (
              <Button type="button" variant="ghost" onClick={() => { setAdding(false); setCode(""); setError(null); }} disabled={busy === "connect"}>
                Cancel
              </Button>
            )}
            <Button type="submit" variant="accent" className="flex-1" disabled={code.length !== PAIRING_CODE_LENGTH || Boolean(busy)}>
              {busy === "connect" ? <Loader2 className="animate-spin" /> : <Tv />} Connect display
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="outline" className="w-full" onClick={() => setAdding(true)} disabled={Boolean(busy)}>
          <Plus /> Connect another display
        </Button>
      )}

      {active.length === 0 && (
        <p className="text-xs text-muted-foreground">It connects separately, so the game keeps running on the TV even if this device sleeps.</p>
      )}

      {active.length > 0 && (
        <ul className="space-y-2">
          {active.map((s) => (
            <li key={s.id} className="flex items-center gap-3 rounded-xl bg-secondary/40 py-2 pr-1 pl-3">
              <Tv className="size-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{s.label}</p>
                <p className="text-xs text-muted-foreground">{s.connected ? "Showing the game" : "Offline"}</p>
              </div>
              <Button size="icon-sm" variant="ghost" aria-label={`Disconnect ${s.label}`} disabled={Boolean(busy)} onClick={() => void revoke(s.id)}>
                {busy === `revoke:${s.id}` ? <Loader2 className="animate-spin" /> : <Unplug className="text-muted-foreground" />}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
