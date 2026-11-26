import { Check, Clock, Plus, Users } from "lucide-react";
import { motion } from "motion/react";
import { GameArt } from "@/features/games/GameArt";
import { CATEGORY_LABELS } from "@/features/games/registry";
import type { GameModule } from "@/features/games/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/utils/cn";

export function GameCard({
  game,
  mode,
  count,
  playerCount,
  onSelect,
}: {
  game: GameModule;
  mode: "tournament" | "freestyle";
  /** Times this game is in the lineup (tournament) or 1/0 selected (freestyle). */
  count: number;
  playerCount: number;
  onSelect: () => void;
}) {
  const selected = count > 0;
  const playable = game.meta.playable;
  const tooFew = playerCount > 0 && playerCount < game.meta.minPlayers;
  return (
    <motion.button
      layout
      type="button"
      onClick={playable ? onSelect : undefined}
      disabled={!playable}
      aria-pressed={mode === "freestyle" ? selected : undefined}
      aria-label={!playable ? `${game.meta.name} (coming soon)` : mode === "tournament" ? `Add ${game.meta.name} to lineup` : `Select ${game.meta.name}`}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border-2 bg-card/80 text-left transition-colors outline-none",
        "focus-visible:ring-4 focus-visible:ring-ring/50 active:scale-[0.98]",
        selected ? "border-primary shadow-xl shadow-primary/25" : "border-border hover:border-primary/50",
        !playable && "cursor-not-allowed opacity-60 hover:border-border",
      )}
    >
      <GameArt game={game} className="aspect-[16/9] w-full rounded-none" />
      <span
        className={cn(
          "absolute top-3 right-3 grid min-w-10 place-items-center rounded-full px-2 py-2 text-sm font-extrabold shadow-lg transition",
          selected ? "bg-primary text-white" : "bg-background/70 text-white backdrop-blur",
        )}
      >
        {!playable ? (
          <span className="px-1 text-xs font-bold">Soon</span>
        ) : mode === "tournament" ? (
          selected ? <span className="leading-none">×{count}</span> : <Plus className="size-5" />
        ) : selected ? (
          <Check className="size-5" />
        ) : (
          <span className="size-5 rounded-full border-2 border-white/70" />
        )}
      </span>
      {!playable && <Badge className="absolute top-3 left-3 bg-background/80 text-foreground">Coming soon</Badge>}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-extrabold leading-tight">{game.meta.name}</h3>
          <Badge variant="muted">{CATEGORY_LABELS[game.meta.category]}</Badge>
        </div>
        <p className="line-clamp-2 text-sm text-muted-foreground">{game.meta.description}</p>
        <div className="mt-auto flex items-center gap-4 pt-1 text-xs font-semibold text-muted-foreground">
          <span className={cn("inline-flex items-center gap-1", tooFew && "text-warning")}>
            <Users className="size-3.5" /> {game.meta.minPlayers}–{game.meta.maxPlayers}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" /> ~{game.meta.durationMin} min
          </span>
        </div>
      </div>
    </motion.button>
  );
}
