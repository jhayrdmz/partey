import { Copy, Share2 } from "lucide-react";
import { toast } from "sonner";
import { RoomCode } from "@/components/shared/RoomCode";
import { JoinQr } from "@/components/shared/JoinQr";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { joinUrl } from "@/utils/urls";

export function RoomCodeCard({ roomCode, roomName }: { roomCode: string; roomName: string }) {
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
  return (
    <Card className="flex-row items-center gap-5">
      <JoinQr roomCode={roomCode} size={192} className="hidden w-24 shrink-0 p-2 xs:block" />
      <div className="min-w-0 flex-1 space-y-3">
        <p className="text-sm font-semibold text-muted-foreground">Room code</p>
        <RoomCode code={roomCode} size="sm" />
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={share}>
            {"share" in navigator ? <Share2 className="size-4" /> : <Copy className="size-4" />} Invite link
          </Button>
        </div>
      </div>
    </Card>
  );
}
