import { cn } from "@/utils/cn";

/** Confetti from the design: small bars and dots in the four party colours. */
const confetti = [
  { left: "8%", top: "14%", color: "var(--mango)", w: 14, h: 14, delay: "0s", shape: "rounded-full" },
  { left: "86%", top: "18%", color: "var(--guava)", w: 24, h: 10, delay: "1.2s", shape: "rounded-[3px] rotate-[28deg]" },
  { left: "72%", top: "78%", color: "var(--calamansi)", w: 26, h: 9, delay: "2.1s", shape: "rounded-[3px] -rotate-[35deg]" },
  { left: "14%", top: "70%", color: "var(--sky)", w: 12, h: 12, delay: "0.6s", shape: "rounded-[2px] rotate-[18deg]" },
  { left: "48%", top: "8%", color: "var(--mango)", w: 18, h: 7, delay: "1.8s", shape: "rounded-[3px] rotate-[60deg]" },
  { left: "92%", top: "52%", color: "var(--guava)", w: 10, h: 10, delay: "2.6s", shape: "rounded-full" },
];

/** Full-viewport party stage background with drifting confetti. */
export function Backdrop({ className, children, confettiOn = true }: { className?: string; children: React.ReactNode; confettiOn?: boolean }) {
  return (
    // overflow-x-clip, not -hidden: "hidden" turns this into a scroll container, which
    // silently breaks every position: sticky descendant (e.g. BottomBar).
    <div className={cn("stage-bg relative min-h-dvh overflow-x-clip", className)}>
      {confettiOn && (
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          {confetti.map((c, i) => (
            <span
              key={i}
              className={cn("absolute animate-float opacity-60", c.shape)}
              style={{ left: c.left, top: c.top, width: c.w, height: c.h, background: c.color, animationDelay: c.delay }}
            />
          ))}
        </div>
      )}
      {/* Two thin outline rings in the corner, as in the design. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <span className="absolute -right-40 -bottom-52 size-[36rem] rounded-full border-2 border-[var(--ring-line)]" />
        <span className="absolute -right-20 -bottom-28 size-[24rem] rounded-full border-2 border-[var(--ring-line)]" />
      </div>
      <div className="relative">{children}</div>
    </div>
  );
}
