import { useState } from "react";
import { Check, Loader2, MonitorSmartphone, RefreshCw, Tv, Unplug, X } from "lucide-react";
import { toast } from "sonner";
import type { DisplaySessionDoc } from "@shared/types";
import { StatusPill } from "@/components/shared/StatusPill";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLiveQuery } from "@/hooks/useFirestore";
import { useCountdown } from "@/hooks/useCountdown";
import { useNow } from "@/hooks/useNow";
import { call, errorMessage, refs } from "@/services/firebase";
import { appBaseUrl } from "@/utils/urls";

function formatSeconds(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Host-side display management: generate pairing code, approve requests, revoke displays. */
export function DisplayPairingCard({ roomId, hostId }: { roomId: string; hostId: string }) {
  const sessions = useLiveQuery(refs.displaySessions(roomId), `sessions:${roomId}`);
  const pairings = useLiveQuery(refs.hostPairings(roomId, hostId), `pairings:${roomId}:${hostId}`);
  const [busy, setBusy] = useState<string | null>(null);

  const active = sessions.data.filter((s: DisplaySessionDoc) => !s.revoked);
  const now = useNow();
  const live = pairings.data.filter((p) => p.expiresAt.toMillis() > now);
  const request = live.find((p) => p.status === "requested");
  const open = live.find((p) => p.status === "open");
  const remaining = useCountdown(open?.expiresAt.toMillis());

  async function run(key: string, fn: () => Promise<unknown>, success?: string) {
    setBusy(key);
    try {
      await fn();
      if (success) toast.success(success);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const generate = () => run("generate", () => call("createDisplayPairing", { roomId }));

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

      {request ? (
        <div className="space-y-3 rounded-xl border-2 border-sky/60 bg-sky/10 p-4" role="alert">
          <div className="flex items-center gap-3">
            <MonitorSmartphone className="size-8 shrink-0 text-sky" />
            <div className="min-w-0">
              <p className="font-extrabold">Approve this display?</p>
              <p className="truncate text-sm text-muted-foreground">{request.requesterLabel ?? "A display"} wants to show this room.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              disabled={Boolean(busy)}
              onClick={() => run("deny", () => call("resolveDisplayPairing", { roomId, pairingId: request.id, approve: false }), "Display denied")}
            >
              {busy === "deny" ? <Loader2 className="animate-spin" /> : <X />} Deny
            </Button>
            <Button
              variant="accent"
              disabled={Boolean(busy)}
              onClick={() => run("approve", () => call("resolveDisplayPairing", { roomId, pairingId: request.id, approve: true }), "Display connected!")}
            >
              {busy === "approve" ? <Loader2 className="animate-spin" /> : <Check />} Approve
            </Button>
          </div>
        </div>
      ) : open && remaining ? (
        <div className="space-y-3 rounded-xl bg-secondary/50 p-4 text-center">
          <p className="text-sm text-muted-foreground">
            On the TV, open <span className="font-bold text-foreground">{appBaseUrl().replace(/^https?:\/\//, "")}/display</span> and enter:
          </p>
          <p className="font-mono text-4xl font-extrabold tracking-[0.2em] text-white tabular-nums sm:text-5xl" aria-label={`Pairing code ${open.code?.split("").join(" ")}`}>
            {open.code?.slice(0, 3)} {open.code?.slice(3)}
          </p>
          <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground">
            <span className="tabular-nums">Expires in {formatSeconds(remaining)}</span>
            <Button size="sm" variant="ghost" onClick={generate} disabled={Boolean(busy)}>
              {busy === "generate" ? <Loader2 className="animate-spin" /> : <RefreshCw className="size-4" />} New code
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {active.length === 0 && (
            <p className="text-sm text-muted-foreground">Show the game on a TV, monitor or tablet. It connects separately, so it keeps running even if this device sleeps.</p>
          )}
          <Button variant={active.length ? "outline" : "accent"} className="w-full" onClick={generate} disabled={Boolean(busy)}>
            {busy === "generate" ? <Loader2 className="animate-spin" /> : <Tv />}
            {active.length ? "Connect another display" : "Connect a display"}
          </Button>
        </div>
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
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Disconnect ${s.label}`}
                disabled={Boolean(busy)}
                onClick={() => run(`revoke:${s.id}`, () => call("revokeDisplay", { roomId, displayId: s.id }), "Display disconnected")}
              >
                {busy === `revoke:${s.id}` ? <Loader2 className="animate-spin" /> : <Unplug className="text-muted-foreground" />}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
