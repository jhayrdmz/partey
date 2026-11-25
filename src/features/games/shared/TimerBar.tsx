import { Pause } from "lucide-react";
import { useServerCountdown } from "@/hooks/useServerClock";
import { cn } from "@/utils/cn";

/** Countdown driven by the server clock. Turns urgent in the last 5 seconds. */
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
