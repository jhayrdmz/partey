import { cn } from "@/utils/cn";
import type { GameModule } from "./types";

/** Game artwork: a flat colour tile (the game's `art.from`), a big emoji and an icon watermark. */
export function GameArt({ game, className, size = "md" }: { game: GameModule; className?: string; size?: "sm" | "md" | "lg" }) {
  const Icon = game.icon;
  return (
    <div
      aria-hidden
      className={cn("relative isolate overflow-hidden rounded-xl", className)}
      style={{ background: game.art.from }}
    >
      <Icon className="absolute -right-3 -bottom-3 size-[70%] max-h-24 rotate-[-12deg] text-background/15" strokeWidth={1.5} />
      <span
        className={cn(
          "absolute inset-0 grid place-items-center",
          size === "sm" && "text-2xl",
          size === "md" && "text-5xl",
          size === "lg" && "text-7xl md:text-8xl",
        )}
      >
        {game.art.emoji}
      </span>
    </div>
  );
}
