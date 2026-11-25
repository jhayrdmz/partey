import { cn } from "@/utils/cn";
import type { GameModule } from "./types";

/** Placeholder artwork: gradient tile + big emoji + icon watermark. */
export function GameArt({ game, className, size = "md" }: { game: GameModule; className?: string; size?: "sm" | "md" | "lg" }) {
  const Icon = game.icon;
  return (
    <div
      aria-hidden
      className={cn("relative isolate overflow-hidden rounded-xl", className)}
      style={{ background: `linear-gradient(135deg, ${game.art.from}, ${game.art.to})` }}
    >
      <div className="absolute inset-0 -z-10 opacity-30 [background:radial-gradient(circle_at_20%_20%,white,transparent_45%)]" />
      <Icon className="absolute -right-3 -bottom-3 size-[70%] max-h-24 rotate-[-12deg] text-white/15" strokeWidth={1.5} />
      <span
        className={cn(
          "absolute inset-0 grid place-items-center drop-shadow-[0_4px_12px_rgba(0,0,0,0.35)]",
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
