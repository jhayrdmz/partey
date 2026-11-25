import { useState } from "react";
import { CheckCircle2, ListOrdered, Pencil, PlayCircle, SlidersHorizontal } from "lucide-react";
import { Link } from "react-router";
import { speedQuizSettings } from "@shared/gameSettings";
import type { RoomDoc } from "@shared/types";
import { GameArt } from "@/features/games/GameArt";
import { getGame } from "@/features/games/registry";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/utils/cn";
import { SpeedQuizOptionsDialog } from "./SpeedQuizOptionsDialog";

export function LineupCard({ room, roomId }: { room: RoomDoc; roomId: string }) {
  const isTournament = room.gameMode === "tournament";
  const editable = room.status === "waiting" && (!isTournament || room.currentGameIndex === 0);
  // Options can change between games, even mid-tournament; a running game keeps its own.
  const optionsEditable = room.status === "waiting";
  const [optionsOpen, setOptionsOpen] = useState(false);
  const quiz = speedQuizSettings(room.gameSettings?.["speed-quiz"]);
  const quizSummary = `${quiz.questionSeconds === 0 ? "No time limit" : `${quiz.questionSeconds}s`} · ${quiz.rounds} questions · max ${quiz.maxPlayers} players`;
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
                <p className={cn("text-xs text-muted-foreground", entry.gameId === "speed-quiz" ? "line-clamp-2" : "truncate")}>{entry.gameId === "speed-quiz" ? quizSummary : game.meta.tagline}</p>
              </div>
              {entry.gameId === "speed-quiz" && optionsEditable && !done && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="shrink-0 rounded-md"
                  onClick={() => setOptionsOpen(true)}
                  aria-label="Speed Quiz options"
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
      <SpeedQuizOptionsDialog room={room} roomId={roomId} open={optionsOpen} onOpenChange={setOptionsOpen} />
    </Card>
  );
}
