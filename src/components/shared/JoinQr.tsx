import { QRCodeSVG } from "qrcode.react";
import { cn } from "@/utils/cn";
import { joinUrl } from "@/utils/urls";

export function JoinQr({ roomCode, size = 200, className }: { roomCode: string; size?: number; className?: string }) {
  return (
    <div className={cn("inline-block rounded-2xl bg-white p-3 shadow-2xl shadow-primary/30", className)}>
      <QRCodeSVG value={joinUrl(roomCode)} size={size} level="M" bgColor="#ffffff" fgColor="#0b0b24" title={`Join room ${roomCode}`} className="block h-auto w-full" />
    </div>
  );
}
