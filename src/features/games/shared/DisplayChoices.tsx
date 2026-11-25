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
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:gap-6">
      {options.map((option, i) => {
        const s = choiceStyle(i);
        const win = reveal?.highlight.includes(i);
        const count = reveal?.counts[i] ?? 0;
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: reveal && !win ? 0.45 : 1, scale: win ? 1.02 : 1 }}
            transition={{ delay: reveal ? 0 : i * 0.08 }}
            className={cn(
              "relative flex min-h-20 items-center gap-2.5 overflow-hidden rounded-2xl px-3 py-3 text-white shadow-xl sm:min-h-24 sm:gap-5 sm:rounded-3xl sm:px-6 sm:py-5 lg:min-h-32",
              s.bg,
              win && "ring-4 ring-white/90 sm:ring-8",
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
            <span className="relative min-w-0 flex-1 text-lg leading-tight font-extrabold break-words sm:text-2xl lg:text-4xl">{option}</span>
            {reveal && (
              <span className="relative flex shrink-0 items-center gap-3">
                {reveal.picks?.[i]?.slice(0, 5).map((p) => (
                  <AvatarBubble key={p.playerId} avatar={p.avatar} size="sm" className="-ml-4 hidden first:ml-0 sm:inline-grid" />
                ))}
                <span className="text-2xl font-black tabular-nums sm:text-3xl lg:text-5xl">{count}</span>
              </span>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
