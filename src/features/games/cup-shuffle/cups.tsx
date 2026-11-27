import { useId } from "react";
import { cn } from "@/utils/cn";
import type { CupPose } from "./timeline";

/* ─── Art ──────────────────────────────────────────────────────────────── */

/** A glossy red cup, upside down (opening at the bottom). */
export function CupArt({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 120 140" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-body`} x1="0" x2="1">
          <stop offset="0" stopColor="#7a0a15" />
          <stop offset="0.22" stopColor="#d81f33" />
          <stop offset="0.38" stopColor="#ff5a68" />
          <stop offset="0.55" stopColor="#e3253a" />
          <stop offset="1" stopColor="#6e0812" />
        </linearGradient>
        <linearGradient id={`${id}-rim`} x1="0" x2="1">
          <stop offset="0" stopColor="#5c0610" />
          <stop offset="0.35" stopColor="#c41a2d" />
          <stop offset="1" stopColor="#550510" />
        </linearGradient>
      </defs>
      {/* Body: narrow closed top, wide open bottom. */}
      <path d="M32 12 L88 12 L108 118 L12 118 Z" fill={`url(#${id}-body)`} />
      <ellipse cx="60" cy="12" rx="28" ry="7" fill="#a5101f" />
      <ellipse cx="60" cy="11" rx="22" ry="4.5" fill="#c81a2c" />
      {/* Ridges. */}
      <path d="M26 46 L94 46" stroke="#000" strokeOpacity="0.16" strokeWidth="3" />
      <path d="M22 70 L98 70" stroke="#000" strokeOpacity="0.12" strokeWidth="3" />
      {/* Rim. */}
      <path d="M10 116 L110 116 L112 130 Q60 138 8 130 Z" fill={`url(#${id}-rim)`} />
      {/* Gloss. */}
      <path d="M40 18 L48 18 L36 112 L26 112 Z" fill="#fff" opacity="0.42" />
      <path d="M52 18 L55 18 L48 112 L44 112 Z" fill="#fff" opacity="0.22" />
    </svg>
  );
}

export function BallArt({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-ball`} cx="0.35" cy="0.3" r="0.75">
          <stop offset="0" stopColor="#fffbd1" />
          <stop offset="0.3" stopColor="#ffe23a" />
          <stop offset="0.8" stopColor="#f5b800" />
          <stop offset="1" stopColor="#c98f00" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill={`url(#${id}-ball)`} />
      <ellipse cx="36" cy="30" rx="13" ry="8" fill="#fff" opacity="0.6" transform="rotate(-30 36 30)" />
    </svg>
  );
}

/* ─── Table ────────────────────────────────────────────────────────────── */

/**
 * Three cups on a table. `poses` are by cup id; `ballCup` is the cup hiding the ball (drawn only
 * while that cup is lifted). `labels` go under the three slots.
 */
export function CupTable({
  poses,
  ballCup,
  labels,
  highlight,
  pick,
  className,
}: {
  poses: CupPose[];
  ballCup: number | null;
  labels?: React.ReactNode[];
  /** Slot to ring (e.g. where the ball is). */
  highlight?: number | null;
  /** Phone: the three slots become buttons (always present, enabled while `open`). */
  pick?: { open: boolean; picked: number | null; onPick: (slot: number) => void };
  className?: string;
}) {
  return (
    <div className={cn("relative mx-auto w-full [--cup:min(26vw,15rem)] [--gap:calc(var(--cup)*1.3)]", className)}>
      {/* Cup (1.17 × its width tall) plus headroom for lifting it (0.62). */}
      <div className="relative h-[calc(var(--cup)*1.85)]">
        {/* Table shadows (stay put while cups lift). */}
        {poses.map((p, cup) => (
          <div
            key={`s${cup}`}
            className="absolute bottom-[calc(var(--cup)*0.02)] h-[calc(var(--cup)*0.14)] w-[var(--cup)] -translate-x-1/2 rounded-[50%] bg-black/35 blur-[2px]"
            style={{ left: `calc(50% + ${(p.x - 1)} * var(--gap))`, opacity: 1 - p.lift * 0.6, transform: `translateX(-50%) scale(${1 - p.lift * 0.25})` }}
          />
        ))}
        {ballCup !== null && poses[ballCup].lift > 0.05 && (
          <div
            className="absolute bottom-[calc(var(--cup)*0.05)] z-0 w-[calc(var(--cup)*0.42)] -translate-x-1/2"
            style={{ left: `calc(50% + ${poses[ballCup].x - 1} * var(--gap))` }}
            data-testid="ball"
          >
            <BallArt className="w-full drop-shadow-lg" />
          </div>
        )}
        {poses.map((p, cup) => (
          <div
            key={cup}
            data-cup={cup}
            className="absolute bottom-0 w-[var(--cup)] will-change-transform"
            style={{
              left: `calc(50% + ${p.x - 1} * var(--gap))`,
              transform: `translateX(-50%) translateY(calc(${-p.lift * 0.62} * var(--cup) + ${-p.depth * 0.06} * var(--cup))) scale(${1 + p.depth * 0.08})`,
              zIndex: p.depth > 0.01 ? 3 : p.depth < -0.01 ? 1 : 2,
            }}
          >
            <CupArt className="w-full drop-shadow-[0_8px_8px_rgba(0,0,0,0.35)]" />
          </div>
        ))}
        {pick &&
          [0, 1, 2].map((slot) => (
            <button
              key={`b${slot}`}
              type="button"
              disabled={!pick.open || pick.picked !== null}
              onClick={() => pick.onPick(slot)}
              aria-label={`Cup ${slot + 1} (${["left", "middle", "right"][slot]})`}
              aria-pressed={pick.picked === slot}
              className={cn(
                "absolute inset-y-0 z-10 w-[calc(var(--cup)*1.15)] -translate-x-1/2 rounded-3xl border-4 outline-none transition-colors focus-visible:ring-4 focus-visible:ring-white/70",
                pick.picked === slot ? "border-mango bg-mango/15" : pick.open && pick.picked === null ? "border-white/25 active:bg-white/10" : "border-transparent",
              )}
              style={{ left: `calc(50% + ${slot - 1} * var(--gap))` }}
            />
          ))}
      </div>
      {labels && (
        // Three columns, each `--gap` wide and centred, line up with the cups' slots; height fits the content.
        <div className="relative left-1/2 mt-3 grid w-[calc(var(--gap)*3)] -translate-x-1/2 grid-cols-3 justify-items-center">
          {labels.map((label, slot) => (
            <div
              key={slot}
              className={cn("flex w-[calc(var(--cup)*1.1)] flex-col items-center gap-1 rounded-2xl py-1 text-center", highlight === slot && "bg-success/15 ring-2 ring-success")}
            >
              {label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
