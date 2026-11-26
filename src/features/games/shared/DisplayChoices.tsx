import { Check } from "lucide-react";
import { motion } from "motion/react";
import type { PlayerPick } from "@shared/engine";
import { AvatarBubble } from "@/components/shared/AvatarBubble";
import { cn } from "@/utils/cn";
import { choiceStyle } from "./choiceColors";

/**
 * Big-screen option tiles. In reveal mode they show answer counts as bars,
 * highlight the winning option(s) and dim the rest.
 */
export function DisplayChoices({
  options,
  reveal,
}: {
  options: string[];
  reveal?: { highlight: number[]; counts: number[]; picks?: PlayerPick[][] };
}) {
  const total = reveal ? Math.max(1, reveal.counts.reduce((a, b) => a + b, 0)) : 1;
  // Long answers in two narrow phone columns break mid-word; give them the full width.
  const long = options.some((o) => o.length > 18);
  return (
    <div className={cn("grid grid-cols-2 gap-2.5 sm:gap-4 lg:gap-[calc(1.5rem*var(--fit-c,1))]", long && "max-sm:grid-cols-1")}>
      {options.map((option, i) => {
        const s = choiceStyle(i);
        const win = reveal?.highlight.includes(i);
        const count = reveal?.counts[i] ?? 0;
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: reveal && !win ? 0.45 : 1, scale: 1 }}
            transition={{ delay: reveal ? 0 : i * 0.08 }}
            className={cn(
              "relative flex min-h-[calc(5rem*var(--fit-c,1))] items-center gap-2.5 overflow-hidden rounded-2xl px-3 py-[calc(0.75rem*var(--fit-c,1))] text-background sm:min-h-[calc(6rem*var(--fit-c,1))] sm:gap-5 sm:rounded-3xl sm:px-6 sm:py-[calc(1.25rem*var(--fit-c,1))] lg:min-h-[calc(8rem*var(--fit-c,1))]",
              s.bg,
            )}
          >
            {reveal && (
              <motion.span
                aria-hidden
                className="absolute inset-y-0 left-0 bg-black/20"
                initial={{ width: 0 }}
                animate={{ width: `${(count / total) * 100}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            )}
            <span className="relative grid size-10 shrink-0 place-items-center rounded-xl bg-black/25 text-2xl font-black sm:size-14 sm:rounded-2xl sm:text-3xl lg:size-16 lg:text-4xl">
              {win ? <Check className="size-6 sm:size-9" strokeWidth={3.5} /> : s.letter}
            </span>
            <span className="relative min-w-0 flex-1 text-[length:calc(1.125rem*var(--fit-c,1))] leading-tight font-extrabold break-words sm:text-[length:calc(1.5rem*var(--fit-c,1))] lg:text-[length:calc(2.25rem*var(--fit-c,1))]">{option}</span>
            {reveal && (
              <span className="relative flex shrink-0 items-center gap-3">
                {reveal.picks?.[i]?.slice(0, 5).map((p) => (
                  <AvatarBubble key={p.playerId} avatar={p.avatar} size="sm" className="-ml-4 hidden first:ml-0 sm:inline-grid" />
                ))}
                <span className="text-[length:calc(1.5rem*var(--fit-c,1))] font-black tabular-nums sm:text-[length:calc(1.875rem*var(--fit-c,1))] lg:text-[length:calc(3rem*var(--fit-c,1))]">{count}</span>
              </span>
            )}
            {/* Drawn inside the tile, on top of the count bar: an outer ring or a scale-up
                would spill past the screen edge, where the fit-to-screen box clips it. */}
            {win && <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit] border-4 border-background sm:border-[6px] lg:border-8" />}
          </motion.div>
        );
      })}
    </div>
  );
}
