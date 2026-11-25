import { useCallback, useState } from "react";
import { Loader2, Plus, ScanQrCode, Tv, Unplug } from "lucide-react";
import { toast } from "sonner";
import { PAIRING_CODE_LENGTH } from "@shared/constants";
import type { DisplaySessionDoc } from "@shared/types";
import { CodeInput } from "@/components/shared/CodeInput";
import { StatusPill } from "@/components/shared/StatusPill";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLiveQuery } from "@/hooks/useFirestore";
import { call, errorMessage, refs } from "@/services/firebase";
import { cn } from "@/utils/cn";
import { displayUrlLabel } from "@/utils/urls";
import { DisplayQrScanner } from "./DisplayQrScanner";

/**
 * Host-side display management. Connect a display by scanning its QR code (connects
 * automatically) or typing the code it shows (submits on the last digit); revoke displays.
 */
export function DisplayPairingCard({ roomId, bare = false }: { roomId: string; /** No card chrome (inside a dialog). */ bare?: boolean }) {
  const sessions = useLiveQuery(refs.displaySessions(roomId), `sessions:${roomId}`);
  const [busy, setBusy] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [scanning, setScanning] = useState(false);

  const active = sessions.data.filter((s: DisplaySessionDoc) => !s.revoked);
  // First display: show the code entry right away. Afterwards it's one tap away.
  const showEntry = active.length === 0 || adding;

  const claim = useCallback(
    async (value: string) => {
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
    },
    [roomId],
  );

  // Stable, so the open camera isn't restarted on every render.
  const onScanned = useCallback(
    (value: string) => {
      setScanning(false);
      setCode(value);
      void claim(value);
    },
    [claim],
  );

  function connect(value = code) {
    if (value.length !== PAIRING_CODE_LENGTH || busy) return;
    void claim(value);
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
    <Card className={cn("gap-3", bare && "rounded-none border-0 bg-transparent p-0 shadow-none backdrop-blur-none")}>
      <div className={cn("flex items-center justify-between gap-2", bare && "pr-10")}>
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
            connect();
          }}
        >
          <p className="text-sm text-muted-foreground">
            On the TV, open <span className="font-bold break-all text-foreground">{displayUrlLabel()}</span>, then scan its QR code or type the code it shows.
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
            boxClassName="rounded-md"
            onComplete={(v) => connect(v)}
          />
          {busy === "connect" && (
            <p className="flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground" role="status">
              <Loader2 className="size-4 animate-spin" /> Connecting…
            </p>
          )}
          {error && (
            <p className="text-center text-sm font-semibold text-destructive" role="alert">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            {active.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setAdding(false);
                  setCode("");
                  setError(null);
                }}
                disabled={busy === "connect"}
              >
                Cancel
              </Button>
            )}
            <Button type="button" variant="accent" className="flex-1" onClick={() => setScanning(true)} disabled={Boolean(busy)}>
              <ScanQrCode /> Scan QR code
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

      <Dialog open={scanning} onOpenChange={setScanning}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Scan the display's QR code</DialogTitle>
            <DialogDescription>It connects as soon as the code is read.</DialogDescription>
          </DialogHeader>
          {/* Mounted only while open, so the camera turns off when the dialog closes. */}
          {scanning && <DisplayQrScanner onCode={onScanned} />}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
