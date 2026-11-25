import { useState } from "react";
import { Loader2, UserMinus, Users } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import type { PlayerDoc } from "@shared/types";
import { AvatarBubble } from "@/components/shared/AvatarBubble";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { call, errorMessage, type WithId } from "@/services/firebase";

export function PlayerListCard({
  roomId,
  players,
  loading,
  showScores,
  cap,
}: {
  roomId: string;
  /** Room capacity for the selected game (see roomPlayerCap). */
  cap: number;
  players: WithId<PlayerDoc>[];
  loading: boolean;
  showScores: boolean;
}) {
  const [toKick, setToKick] = useState<WithId<PlayerDoc> | null>(null);
  const [kicking, setKicking] = useState(false);
  const online = players.filter((p) => p.status === "online").length;

  async function kick() {
    if (!toKick) return;
    setKicking(true);
    try {
      await call("kickPlayer", { roomId, playerId: toKick.id });
      toast.success(`${toKick.nickname} was removed`);
      setToKick(null);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setKicking(false);
    }
  }

  const list = showScores ? [...players].sort((a, b) => b.score - a.score) : players;

  return (
    <Card className="gap-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-extrabold">
          <Users className="size-5 text-mango" /> Players
        </h2>
        <div className="flex items-center gap-2">
          <Badge variant="success">{online} online</Badge>
          <Badge variant="muted" className="tabular-nums">
            {players.length}/{cap}
          </Badge>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : players.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-border p-6 text-center">
          <p className="font-bold">Waiting for players…</p>
          <p className="mt-1 text-sm text-muted-foreground">Players join by scanning the QR code on the display or entering the room code.</p>
        </div>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <AnimatePresence initial={false}>
            {list.map((p) => (
              <motion.li
                key={p.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center gap-3 rounded-xl bg-secondary/40 py-2 pr-1 pl-2"
              >
                <AvatarBubble avatar={p.avatar} size="sm" online={p.status === "online"} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{p.nickname}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.status === "online" ? "Connected" : "Reconnecting…"}
                    {showScores && <> · <span className="font-bold text-foreground tabular-nums">{p.score} pts</span></>}
                  </p>
                </div>
                <Button size="icon-sm" variant="ghost" aria-label={`Remove ${p.nickname}`} onClick={() => setToKick(p)}>
                  <UserMinus className="text-muted-foreground" />
                </Button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      <Dialog open={Boolean(toKick)} onOpenChange={(open) => !open && setToKick(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {toKick?.nickname}?</DialogTitle>
            <DialogDescription>They'll be removed from the room and won't be able to rejoin with this device.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToKick(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={kick} disabled={kicking}>
              {kicking && <Loader2 className="animate-spin" />} Remove player
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
