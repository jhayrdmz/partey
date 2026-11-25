import { Hourglass, Pause } from "lucide-react";
import { useServerCountdown } from "@/hooks/useServerClock";
import { cn } from "@/utils/cn";

/**
 * Countdown driven by the server clock. Turns urgent in the last 5 seconds.
 * Untimed rounds (durationMs 0) show a "waiting for everyone" label instead.
 */
export function TimerBar({
  endsAtMs,
  durationMs,
  paused,
  remainingMs,
  size = "md",
  className,
}: {
  endsAtMs: number | null;
  durationMs: number;
  paused: boolean;
  remainingMs: number | null;
  size?: "md" | "lg";
  className?: string;
}) {
  const left = useServerCountdown(endsAtMs, { paused, pausedRemainingMs: remainingMs });
  if (durationMs === 0) {
    return (
      <div className={cn("flex items-center", className)}>
        <span
          className={cn(
            "flex items-center gap-2 rounded-full bg-secondary font-bold text-muted-foreground",
            size === "lg" ? "px-5 py-3 text-xl short:py-1.5 short:text-base" : "px-3 py-1.5 text-sm",
          )}
        >
          {paused ? <Pause className={size === "lg" ? "size-6" : "size-4"} /> : <Hourglass className={size === "lg" ? "size-6" : "size-4"} />}
          {paused ? "Paused" : "No time limit · waiting for everyone"}
        </span>
      </div>
    );
  }
  if (left === null) return null;
  const pct = Math.max(0, Math.min(100, (left / Math.max(1, durationMs)) * 100));
  const seconds = Math.ceil(left / 1000);
  const urgent = !paused && seconds <= 5;
  return (
    <div className={cn("flex items-center gap-3", className)} role="timer" aria-label={paused ? "Paused" : `${seconds} seconds left`}>
      <div className={cn("relative flex-1 overflow-hidden rounded-full bg-secondary", size === "lg" ? "h-4" : "h-2.5")}>
        <div
          className={cn("absolute inset-y-0 left-0 rounded-full transition-[width] duration-100 ease-linear", urgent ? "bg-guava" : "bg-gradient-to-r from-sky to-primary")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className={cn(
          "grid place-items-center rounded-full font-black tabular-nums",
          size === "lg" ? "size-20 text-4xl" : "size-11 text-lg",
          urgent ? "bg-guava text-white" : "bg-secondary",
        )}
      >
        {paused ? <Pause className={size === "lg" ? "size-9" : "size-5"} /> : seconds}
      </span>
    </div>
  );
}
