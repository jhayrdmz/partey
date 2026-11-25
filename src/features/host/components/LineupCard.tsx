import { useState } from "react";
import { CheckCircle2, ListOrdered, Pencil, PlayCircle, SlidersHorizontal } from "lucide-react";
import { Link } from "react-router";
import { categoryLabel, impostorSettings, speedQuizSettings } from "@shared/gameSettings";
import type { RoomDoc } from "@shared/types";
import { GameArt } from "@/features/games/GameArt";
import { getGame } from "@/features/games/registry";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/utils/cn";
import { ImpostorOptionsDialog } from "./ImpostorOptionsDialog";
import { SpeedQuizOptionsDialog } from "./SpeedQuizOptionsDialog";

/** Games with host options in the lobby. */
const HAS_OPTIONS = new Set(["speed-quiz", "impostor"]);

export function LineupCard({ room, roomId }: { room: RoomDoc; roomId: string }) {
  const isTournament = room.gameMode === "tournament";
  const editable = room.status === "waiting" && (!isTournament || room.currentGameIndex === 0);
  // Options can change between games, even mid-tournament; a running game keeps its own.
  const optionsEditable = room.status === "waiting";
  const [optionsFor, setOptionsFor] = useState<"speed-quiz" | "impostor" | null>(null);
  const quiz = speedQuizSettings(room.gameSettings?.["speed-quiz"]);
  const imp = impostorSettings(room.gameSettings?.impostor);
  const summaries: Partial<Record<string, string>> = {
    "speed-quiz": `${quiz.questionSeconds === 0 ? "No time limit" : `${quiz.questionSeconds}s`} · ${quiz.rounds} questions · max ${quiz.maxPlayers} players`,
    impostor: `${imp.customWord ? `Custom word (${categoryLabel(imp.category)})` : categoryLabel(imp.category)} · ${imp.impostors} impostor${imp.impostors === 1 ? "" : "s"} · ${imp.clueRounds} clue round${imp.clueRounds === 1 ? "" : "s"} · max ${imp.maxPlayers} players`,
  };
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
                <p className={cn("text-xs text-muted-foreground", summaries[entry.gameId] ? "line-clamp-2" : "truncate")}>{summaries[entry.gameId] ?? game.meta.tagline}</p>
              </div>
              {HAS_OPTIONS.has(entry.gameId) && optionsEditable && !done && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="shrink-0 rounded-md"
                  onClick={() => setOptionsFor(entry.gameId as "speed-quiz" | "impostor")}
                  aria-label={`${game.meta.name} options`}
                >
                  <SlidersHorizontal className="size-4" /> <span className="hidden xs:inline">Options</span>
                </Button>
              )}
              {done ? (
                <CheckCircle2 className="size-5 text-success" aria-label="Played" />
              ) : current && room.status === "playing" ? (
                <PlayCircle className="size-5 text-primary" aria-label="Now playing" />
              ) : null}
            </li>
          );
        })}
      </ol>
      <SpeedQuizOptionsDialog room={room} roomId={roomId} open={optionsFor === "speed-quiz"} onOpenChange={(o) => setOptionsFor(o ? "speed-quiz" : null)} />
      <ImpostorOptionsDialog room={room} roomId={roomId} open={optionsFor === "impostor"} onOpenChange={(o) => setOptionsFor(o ? "impostor" : null)} />
    </Card>
  );
}
