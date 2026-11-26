import { motion } from "motion/react";
import { cn } from "@/utils/cn";
import { choiceStyle } from "./choiceColors";

/** Phone answer buttons: large, thumb-friendly, letter + text. */
export function ChoiceButtons({
  options,
  onPick,
  disabled,
  selected,
}: {
  options: string[];
  onPick: (index: number) => void;
  disabled?: boolean;
  selected?: number | null;
}) {
  return (
    <div className={cn("grid flex-1 gap-3", options.length > 2 ? "grid-rows-4" : "grid-rows-2")} role="group" aria-label="Answers">
      {options.map((option, i) => {
        const s = choiceStyle(i);
        return (
          <motion.button
            key={i}
            type="button"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            disabled={disabled}
            onClick={() => onPick(i)}
            className={cn(
              "flex min-h-16 items-center gap-4 rounded-2xl px-4 text-left text-lg font-extrabold text-background transition outline-none",
              "focus-visible:ring-4 focus-visible:ring-white/70 active:scale-[0.97] disabled:opacity-60",
              s.bg,
              selected === i && "ring-4 ring-white",
            )}
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-black/20 text-xl">{s.letter}</span>
            <span className="leading-tight">{option}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
