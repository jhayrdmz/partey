import { motion } from "motion/react";
import { useServerTimeReached } from "@/hooks/useServerClock";
import { cn } from "@/utils/cn";

/** Full-height tap target for reaction games. Red = wait, green = TAP! */
export function ReactionPad({ goAtMs, paused, onTap, disabled }: { goAtMs: number; paused: boolean; onTap: () => void; disabled?: boolean }) {
  const go = useServerTimeReached(goAtMs, paused);
  return (
    <motion.button
      type="button"
      onPointerDown={(e) => {
        e.preventDefault();
        if (!disabled) onTap();
      }}
      onKeyDown={(e) => (e.key === " " || e.key === "Enter") && !disabled && onTap()}
      disabled={disabled}
      animate={{ scale: go ? [1, 1.03, 1] : 1 }}
      transition={{ duration: 0.25 }}
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-3 rounded-3xl text-white shadow-2xl outline-none select-none",
        "focus-visible:ring-4 focus-visible:ring-white/70",
        go ? "bg-success shadow-success/40" : "bg-destructive shadow-destructive/30",
        paused && "bg-muted",
      )}
      aria-label={go ? "Tap now!" : "Wait for green"}
    >
      <span className="text-6xl font-black tracking-tight">{paused ? "PAUSED" : go ? "TAP!" : "WAIT…"}</span>
      <span className="text-lg font-bold opacity-80">{paused ? "" : go ? "Now! Now! Now!" : "Don't tap until it turns green"}</span>
    </motion.button>
  );
}
