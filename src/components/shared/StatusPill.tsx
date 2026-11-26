import { cn } from "@/utils/cn";

export function StatusDot({ online, className }: { online: boolean; className?: string }) {
  return <span className={cn("inline-block size-2.5 rounded-full", online ? "bg-success animate-pulse-ring" : "bg-muted-foreground/60", className)} />;
}

export function StatusPill({ online, onlineLabel = "Connected", offlineLabel = "Offline", className }: {
  online: boolean;
  onlineLabel?: string;
  offlineLabel?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-md px-3 py-1 text-xs font-bold",
        online ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
        className,
      )}
    >
      <StatusDot online={online} />
      {online ? onlineLabel : offlineLabel}
    </span>
  );
}
