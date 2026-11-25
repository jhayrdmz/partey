import { Copy, Share2 } from "lucide-react";
import { toast } from "sonner";
import { RoomCode } from "@/components/shared/RoomCode";
import { JoinQr } from "@/components/shared/JoinQr";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/utils/cn";
import { joinUrl } from "@/utils/urls";

/**
 * Room code, join QR and invite link. `stacked` is the pop-up layout: a large QR players can
 * scan straight off the host's screen, without card chrome (the dialog provides it).
 */
export function RoomCodeCard({ roomCode, roomName, stacked = false }: { roomCode: string; roomName: string; stacked?: boolean }) {
  const url = joinUrl(roomCode);
  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: `Join ${roomName} on Partey`, text: `Room code ${roomCode}`, url });
        return;
      } catch {
        /* cancelled → fall through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Join link copied");
    } catch {
      toast.error("Couldn't copy the link");
    }
  }
  const shareButton = (
    <Button size={stacked ? "default" : "sm"} variant="secondary" onClick={share} className={cn(stacked && "w-full")}>
      {"share" in navigator ? <Share2 className="size-4" /> : <Copy className="size-4" />} Invite link
    </Button>
  );

  if (stacked) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <JoinQr roomCode={roomCode} size={320} className="w-56 max-w-full" />
        <div className="space-y-2">
          <p className="text-sm font-semibold text-muted-foreground">Room code</p>
          <RoomCode code={roomCode} size="sm" />
        </div>
        {shareButton}
      </div>
    );
  }

  return (
    <Card className="flex-row items-center gap-5">
      <JoinQr roomCode={roomCode} size={192} className="hidden w-24 shrink-0 p-2 xs:block" />
      <div className="min-w-0 flex-1 space-y-3">
        <p className="text-sm font-semibold text-muted-foreground">Room code</p>
        <RoomCode code={roomCode} size="sm" />
        <div className="flex gap-2">{shareButton}</div>
      </div>
    </Card>
  );
}
