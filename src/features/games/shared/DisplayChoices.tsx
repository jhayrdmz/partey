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
    <div className={cn("grid gap-4 lg:gap-6", options.length > 2 ? "grid-cols-2" : "grid-cols-2")}>
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
              "relative flex min-h-24 items-center gap-5 overflow-hidden rounded-3xl px-6 py-5 text-white shadow-xl lg:min-h-32",
              s.bg,
              win && "ring-8 ring-white/90",
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
            <span className="relative grid size-14 shrink-0 place-items-center rounded-2xl bg-black/25 text-3xl font-black lg:size-16 lg:text-4xl">
              {win ? <Check className="size-9" strokeWidth={3.5} /> : s.letter}
            </span>
            <span className="relative flex-1 text-2xl leading-tight font-extrabold lg:text-4xl">{option}</span>
            {reveal && (
              <span className="relative flex items-center gap-3">
                {reveal.picks?.[i]?.slice(0, 5).map((p) => (
                  <AvatarBubble key={p.playerId} avatar={p.avatar} size="sm" className="-ml-4 first:ml-0" />
                ))}
                <span className="text-3xl font-black tabular-nums lg:text-5xl">{count}</span>
              </span>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
