import { cn } from "@/utils/cn";
import type { GameModule } from "./types";

/** Game cover art (16:9, title baked in). Callers size it; keep a 16:9 box so the title isn't cropped. */
export function GameArt({ game, className }: { game: GameModule; className?: string }) {
  return (
    <img
      src={game.art.cover}
      alt=""
      aria-hidden
      decoding="async"
      className={cn("block rounded-xl object-cover", className)}
      style={{ background: game.art.from }}
    />
  );
}

/** Small square game icon (transparent) for lineups, headers and "up next" chips. */
export function GameThumb({ game, className }: { game: GameModule; className?: string }) {
  return <img src={game.art.thumb} alt="" aria-hidden decoding="async" className={cn("block size-10 shrink-0 object-contain", className)} />;
}
