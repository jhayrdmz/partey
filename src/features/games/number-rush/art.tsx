import { useEffect, useState } from "react";
import { ArrowBigDown, ArrowBigUp, Flame } from "lucide-react";
import { motion } from "motion/react";
import type { RushChoice } from "@shared/engine";
import { cn } from "@/utils/cn";
import { CARTOON, CHOICE_LABEL, CHOICE_STYLE, GLOSS } from "./styles";

export function ChoiceIcon({ choice, className }: { choice: RushChoice; className?: string }) {
  const Icon = choice === "higher" ? ArrowBigUp : ArrowBigDown;
  return <Icon className={cn("fill-current", className)} />;
}

/** The big HIGHER / LOWER button on the phone (or a non-interactive badge on the TV). */
export function ChoiceButton({
  choice,
  disabled,
  selected,
  onClick,
  className,
  note,
  stacked,
}: {
  choice: RushChoice;
  disabled?: boolean;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
  /** Small line under the label (e.g. "Nothing is above 999"). */
  note?: string;
  /** Arrow above the label (side-by-side buttons on a phone). */
  stacked?: boolean;
}) {
  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={onClick}
      whileTap={disabled ? undefined : { y: 6, scale: 0.98 }}
      aria-pressed={selected}
      aria-label={CHOICE_LABEL[choice]}
      data-choice={choice}
      className={cn(
        CARTOON,
        "flex w-full flex-col items-center justify-center rounded-[2rem] px-6 py-4",
        CHOICE_STYLE[choice],
        selected && "ring-4 ring-white ring-offset-4 ring-offset-background",
        disabled && !selected && "opacity-35 grayscale",
        className,
      )}
    >
      <span className={GLOSS} />
      {stacked ? (
        <span className="flex flex-col items-center gap-1 text-3xl">
          <ChoiceIcon choice={choice} className="size-14" />
          {CHOICE_LABEL[choice]}
        </span>
      ) : (
        <span className="flex items-center gap-2 text-4xl">
          {choice === "higher" && <ChoiceIcon choice="higher" className="size-10" />}
          {CHOICE_LABEL[choice]}
          {choice === "lower" && <ChoiceIcon choice="lower" className="size-10" />}
        </span>
      )}
      {note && <span className="text-sm font-bold tracking-normal normal-case [text-shadow:none]">{note}</span>}
    </motion.button>
  );
}

/** "HIGHER!" / "LOWER!" stamp for the reveal. */
export function DirectionStamp({ direction, className }: { direction: RushChoice; className?: string }) {
  return (
    <motion.div
      initial={{ scale: 2.4, rotate: -10, opacity: 0 }}
      animate={{ scale: 1, rotate: -4, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 13 }}
      className={cn(CARTOON, "inline-flex items-center gap-2 rounded-[1.75rem] px-6 py-2", CHOICE_STYLE[direction], className)}
      data-direction={direction}
    >
      <span className={GLOSS} />
      <ChoiceIcon choice={direction} className="size-[1.1em]" />
      {CHOICE_LABEL[direction]}!
    </motion.div>
  );
}

/* ─── Number ───────────────────────────────────────────────────────────── */

const TILE =
  "relative grid place-items-center overflow-hidden rounded-[1.25rem] border-[5px] border-[#2a1240] bg-[linear-gradient(#4b2a6e,#2d1748)] font-display font-black text-white tabular-nums shadow-[inset_0_-6px_0_rgba(0,0,0,0.3),0_6px_0_#2a1240] [text-shadow:0_4px_0_rgba(0,0,0,0.35)]";

/** Three digit tiles. `size` scales everything (TV vs phone). */
export function NumberTiles({ digits, size = "lg", locked, className, label }: { digits: string; size?: "sm" | "md" | "lg"; locked?: boolean[]; className?: string; label?: string }) {
  const dims = { sm: "h-20 w-16 text-6xl", md: "h-28 w-22 text-7xl", lg: "h-40 w-32 text-[7rem] lg:h-56 lg:w-44 lg:text-[10rem]" }[size];
  return (
    <div className={cn("flex justify-center gap-2 lg:gap-4", className)} aria-label={label ?? digits} role="img">
      {digits.split("").map((d, i) => (
        <div key={i} className={cn(TILE, dims, locked && !locked[i] && "text-white/70 blur-[1.5px]")} aria-hidden>
          <span className="pointer-events-none absolute inset-x-1.5 top-1 h-[40%] rounded-[0.9rem] bg-white/10" />
          {d}
        </div>
      ))}
    </div>
  );
}

/**
 * The reveal: the digits spin like a slot machine and stop one by one, left to right, on `to`.
 * `onLock(i)` fires as each digit stops (for the tick sounds); `onDone` after the last.
 */
export function RollingNumber({ to, size, onLock, onDone }: { to: number; size?: "sm" | "md" | "lg"; onLock?: (i: number) => void; onDone?: () => void }) {
  const target = String(to);
  const [shown, setShown] = useState(() => "???");
  const [locked, setLocked] = useState([false, false, false]);
  useEffect(() => {
    const start = performance.now();
    const lockAt = [700, 1150, 1600];
    let done = 0;
    const id = window.setInterval(() => {
      const t = performance.now() - start;
      const now = lockAt.map((at) => t >= at);
      setShown(target.split("").map((d, i) => (now[i] ? d : String(Math.floor(Math.random() * 10)))).join(""));
      setLocked(now);
      const count = now.filter(Boolean).length;
      while (done < count) onLock?.(done++);
      if (count === 3) {
        window.clearInterval(id);
        onDone?.();
      }
    }, 55);
    return () => window.clearInterval(id);
    // Runs once per reveal (the component is keyed by round).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <NumberTiles digits={shown} size={size} locked={locked} label={locked.every(Boolean) ? target : "Revealing…"} />;
}

/* ─── Streaks ──────────────────────────────────────────────────────────── */

/** Streak badge: 🔥 3 · 1.25x. `milestone` = this round unlocked a new multiplier (pulses). */
export function StreakBadge({ streak, multiplier, milestone, className }: { streak: number; multiplier: number; milestone?: boolean; className?: string }) {
  if (streak < 1) return null;
  const hot = multiplier >= 2 ? "bg-guava text-white" : multiplier >= 1.5 ? "bg-mango text-black" : multiplier > 1 ? "bg-calamansi text-black" : "bg-card text-foreground";
  return (
    <motion.span
      animate={milestone ? { scale: [1, 1.25, 1] } : undefined}
      transition={milestone ? { repeat: Infinity, duration: 0.9 } : undefined}
      className={cn("inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-sm font-black tabular-nums", hot, milestone && "ring-2 ring-white", className)}
      aria-label={`${streak} in a row, ${multiplier}x`}
    >
      <Flame className="size-4 fill-current" />
      {streak}
      {multiplier > 1 && <span className="ml-1 opacity-90">{multiplier}x</span>}
    </motion.span>
  );
}
