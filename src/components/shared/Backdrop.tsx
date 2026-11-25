import { cn } from "@/utils/cn";

const confetti = [
  { left: "8%", top: "14%", color: "var(--mango)", size: 14, delay: "0s", shape: "rounded-full" },
  { left: "86%", top: "18%", color: "var(--guava)", size: 18, delay: "1.2s", shape: "rounded-sm rotate-12" },
  { left: "72%", top: "78%", color: "var(--calamansi)", size: 12, delay: "2.1s", shape: "rounded-full" },
  { left: "14%", top: "70%", color: "var(--sky)", size: 16, delay: "0.6s", shape: "rounded-sm -rotate-12" },
  { left: "48%", top: "8%", color: "var(--primary)", size: 10, delay: "1.8s", shape: "rounded-full" },
  { left: "92%", top: "52%", color: "var(--mango)", size: 10, delay: "2.6s", shape: "rounded-sm" },
];

/** Full-viewport party stage background with drifting confetti. */
export function Backdrop({ className, children, confettiOn = true }: { className?: string; children: React.ReactNode; confettiOn?: boolean }) {
  return (
    <div className={cn("stage-bg relative min-h-dvh overflow-x-hidden", className)}>
      {confettiOn && (
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          {confetti.map((c, i) => (
            <span
              key={i}
              className={cn("absolute animate-float opacity-60", c.shape)}
              style={{ left: c.left, top: c.top, width: c.size, height: c.size, background: c.color, animationDelay: c.delay }}
            />
          ))}
        </div>
      )}
      <div className="relative">{children}</div>
    </div>
  );
}
