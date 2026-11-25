import { CheckCircle2, ListOrdered, Pencil, PlayCircle } from "lucide-react";
import { Link } from "react-router";
import type { RoomDoc } from "@shared/types";
import { GameArt } from "@/features/games/GameArt";
import { getGame } from "@/features/games/registry";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/utils/cn";

export function LineupCard({ room, roomId }: { room: RoomDoc; roomId: string }) {
  const isTournament = room.gameMode === "tournament";
  const editable = room.status === "waiting" && (!isTournament || room.currentGameIndex === 0);
  return (
    <Card className="gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-extrabold">
          <ListOrdered className="size-5 text-guava" /> {isTournament ? "Tournament lineup" : "Selected game"}
        </h2>
        {editable && (
          <Button asChild size="sm" variant="ghost">
            <Link to={`/host/${roomId}/games`}>
              <Pencil className="size-4" /> {isTournament ? "Edit" : "Change"}
            </Link>
          </Button>
        )}
      </div>
      <ol className="space-y-2">
        {room.lineup.map((entry, i) => {
          const game = getGame(entry.gameId);
          const done = isTournament && (i < room.currentGameIndex || room.status === "finished");
          const current = isTournament ? i === room.currentGameIndex && room.status !== "finished" : true;
          return (
            <li
              key={entry.entryId}
              className={cn(
                "flex items-center gap-3 rounded-xl p-2",
                current ? "bg-primary/15 ring-1 ring-primary/40" : "bg-secondary/40",
                done && "opacity-60",
              )}
            >
              {isTournament && <span className="w-5 text-center text-sm font-extrabold text-muted-foreground">{i + 1}</span>}
              <GameArt game={game} size="sm" className="size-11 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{game.meta.name}</p>
                <p className="truncate text-xs text-muted-foreground">{game.meta.tagline}</p>
              </div>
              {done ? (
                <CheckCircle2 className="size-5 text-success" aria-label="Played" />
              ) : current && room.status === "playing" ? (
                <PlayCircle className="size-5 text-primary" aria-label="Now playing" />
              ) : null}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
