import { ChevronDown, ChevronUp, ListOrdered, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { getGame } from "@/features/games/registry";
import { GameArt } from "@/features/games/GameArt";
import type { DraftEntry } from "@/stores/lineupDraftStore";
import { Button } from "@/components/ui/button";

export function LineupEditor({
  entries,
  onMove,
  onRemove,
  totalMinutes,
}: {
  entries: DraftEntry[];
  onMove: (key: string, dir: -1 | 1) => void;
  onRemove: (key: string) => void;
  totalMinutes: number;
}) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">
        <ListOrdered className="size-8" />
        <p className="font-semibold">No games yet</p>
        <p className="text-sm">Tap games to add them. You can add the same game more than once.</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {entries.length} game{entries.length === 1 ? "" : "s"} · about {totalMinutes} min
      </p>
      <ol className="space-y-2">
        <AnimatePresence initial={false}>
          {entries.map((entry, i) => {
            const game = getGame(entry.gameId);
            return (
              <motion.li
                key={entry.key}
                layout
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 40 }}
                className="flex items-center gap-2 rounded-xl border border-border bg-secondary/40 p-2"
              >
                <span className="w-6 text-center text-sm font-extrabold text-muted-foreground">{i + 1}</span>
                <GameArt game={game} size="sm" className="size-9 shrink-0 [&>span]:text-lg" />
                <span className="min-w-0 flex-1 truncate text-sm font-bold sm:text-base">{game.meta.name}</span>
                <div className="flex shrink-0 items-center">
                  <Button size="icon-sm" variant="ghost" aria-label={`Move ${game.meta.name} up`} disabled={i === 0} onClick={() => onMove(entry.key, -1)}>
                    <ChevronUp />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Move ${game.meta.name} down`}
                    disabled={i === entries.length - 1}
                    onClick={() => onMove(entry.key, 1)}
                  >
                    <ChevronDown />
                  </Button>
                  <Button size="icon-sm" variant="ghost" aria-label={`Remove ${game.meta.name}`} onClick={() => onRemove(entry.key)}>
                    <Trash2 className="text-destructive" />
                  </Button>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ol>
    </div>
  );
}
